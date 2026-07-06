import { createHmac } from 'crypto';
import { prisma } from './db';
import { env } from './config';

interface FanoutJob {
  orgId: string;
  messageId: string;
  eventType: string;
  eventId: string;
  occurredAt: string;
}

// Header names must match packages/shared/src/webhook.ts — kept as literals here to avoid
// depending on shared at runtime for a tiny constant.
const HEADER_SIG = 'X-Webhook-Signature';
const HEADER_EVENT_ID = 'X-Webhook-Event-Id';
const HEADER_EVENT_TYPE = 'X-Webhook-Event';
const HEADER_TS = 'X-Webhook-Timestamp';

export async function fanout(job: FanoutJob): Promise<void> {
  // 1. Load subscribed webhooks — filter Postgres-side using `has`.
  const webhooks = await prisma.webhook.findMany({
    where: {
      orgId: job.orgId,
      active: true,
      events: { has: job.eventType as any },
    },
  });
  if (webhooks.length === 0) return;

  // 2. Load message + event to build the payload once, reused for every subscriber.
  const [message, event] = await Promise.all([
    prisma.message.findUnique({
      where: { id: job.messageId },
      select: {
        id: true,
        orgId: true,
        kind: true,
        status: true,
        fromAddress: true,
        toAddresses: true,
        subject: true,
        messageIdHeader: true,
      },
    }),
    prisma.messageEvent.findUnique({
      where: { id: job.eventId },
      select: { detail: true, occurredAt: true },
    }),
  ]);
  if (!message || !event) return;

  const payload = {
    id: job.eventId,
    event: job.eventType,
    occurredAt: event.occurredAt.toISOString(),
    message: {
      id: message.id,
      orgId: message.orgId,
      kind: message.kind,
      status: message.status,
      from: message.fromAddress,
      to: message.toAddresses,
      subject: message.subject,
      messageIdHeader: message.messageIdHeader,
    },
    detail: event.detail,
  };
  const body = JSON.stringify(payload);
  const timestamp = event.occurredAt.getTime().toString();

  // 3. POST to each subscriber. One failed subscriber shouldn't block the others.
  await Promise.all(webhooks.map((w) => postOne(w, body, timestamp, job.eventId, job.eventType)));
}

async function postOne(
  webhook: { id: string; url: string; secret: string },
  body: string,
  timestamp: string,
  eventId: string,
  eventType: string,
): Promise<void> {
  // HMAC over `<timestamp>.<body>` — customer computes the same and compares constant-time.
  const signature = createHmac('sha256', webhook.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.WEBHOOKS_TIMEOUT_MS);

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType: eventType as any,
      payload: JSON.parse(body),
      attempts: 1,
    },
  });

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        [HEADER_SIG]: `sha256=${signature}`,
        [HEADER_EVENT_ID]: eventId,
        [HEADER_EVENT_TYPE]: eventType,
        [HEADER_TS]: timestamp,
      },
      body,
    });

    if (res.status >= 200 && res.status < 300) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { lastStatus: res.status, succeededAt: new Date() },
      });
    } else {
      // Non-2xx → let BullMQ retry via thrown error at the worker layer.
      const err = new Error(`webhook ${webhook.id} returned ${res.status}`);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { lastStatus: res.status, lastError: `HTTP ${res.status}` },
      });
      throw err;
    }
  } catch (err: any) {
    if (!delivery) throw err;
    const msg = err?.message ?? String(err);
    await prisma.webhookDelivery
      .update({
        where: { id: delivery.id },
        data: { lastError: msg.slice(0, 500) },
      })
      .catch(() => {});
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
