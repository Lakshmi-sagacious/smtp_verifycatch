import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './config';
import { prisma } from './db';
import { deliverOne, type DeliveryResult } from './deliver';

interface DeliveryJob {
  messageId: string;
  orgId: string;
}

interface WebhookFanoutJob {
  orgId: string;
  messageId: string;
  eventType: string;
  eventId: string;
  occurredAt: string;
}

export function startWorker() {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const webhookQueue = new Queue<WebhookFanoutJob>('webhook-fanout', { connection });

  const emit = async (
    orgId: string,
    messageId: string,
    type: string,
    detail?: unknown,
  ) => {
    const event = await prisma.messageEvent.create({
      data: { messageId, type: type as any, detail: detail as any },
    });
    await webhookQueue.add(
      'fanout',
      {
        orgId,
        messageId,
        eventType: type,
        eventId: event.id,
        occurredAt: event.occurredAt.toISOString(),
      },
      { jobId: event.id },
    );
  };

  const worker = new Worker<DeliveryJob>(
    'deliveries',
    async (job: Job<DeliveryJob>) => {
      const { messageId } = job.data;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { domain: true },
      });
      if (!message) throw new Error(`Message ${messageId} not found`);
      if (!message.domain) throw new Error(`Message ${messageId} has no domain`);
      if (message.status === 'DELIVERED') return;

      await prisma.message.update({ where: { id: message.id }, data: { status: 'SENDING' } });
      await emit(message.orgId, message.id, 'SENDING', { attempt: job.attemptsMade + 1 });

      const results: DeliveryResult[] = [];
      for (const rcpt of message.rcptTo) {
        const r = await deliverOne(message, message.domain, rcpt);
        results.push(r);
        await recordAttempt(emit, message.id, message.orgId, rcpt, r);
      }

      const anyDeferred = results.some((r) => r.status === 'DEFERRED');
      const anyBounced = results.some((r) => r.status === 'BOUNCED');
      const allDelivered = results.every((r) => r.status === 'DELIVERED');

      const finalStatus = allDelivered
        ? 'DELIVERED'
        : anyDeferred
          ? 'DEFERRED'
          : anyBounced
            ? 'BOUNCED'
            : 'DEFERRED';

      await prisma.message.update({ where: { id: message.id }, data: { status: finalStatus } });

      if (finalStatus === 'DEFERRED') {
        throw new Error(`Deferred (${results.filter((r) => r.status === 'DEFERRED').length} recipients)`);
      }
    },
    {
      connection,
      concurrency: env.MAILER_CONCURRENCY,
    },
  );

  worker.on('completed', (job) =>
    // eslint-disable-next-line no-console
    console.log(`[mailer] delivered ${job.data.messageId}`),
  );
  worker.on('failed', (job, err) =>
    // eslint-disable-next-line no-console
    console.error(`[mailer] failed ${job?.data.messageId} attempt ${job?.attemptsMade}: ${err.message}`),
  );

  return { worker, connection, webhookQueue };
}

async function recordAttempt(
  emit: (orgId: string, messageId: string, type: string, detail?: unknown) => Promise<void>,
  messageId: string,
  orgId: string,
  recipient: string,
  result: DeliveryResult,
) {
  const eventType =
    result.status === 'DELIVERED'
      ? 'DELIVERED'
      : result.status === 'BOUNCED'
        ? 'BOUNCED'
        : 'DEFERRED';

  await emit(orgId, messageId, eventType, {
    recipient,
    response: result.response,
    code: result.code,
    category: result.category,
    host: result.hostAttempted,
  });

  if (result.category === 'HARD_BOUNCE') {
    await prisma.suppressionEntry
      .upsert({
        where: { orgId_email: { orgId, email: recipient } },
        create: {
          orgId,
          email: recipient,
          reason: 'HARD_BOUNCE',
          detail: result.response?.slice(0, 500),
        },
        update: {},
      })
      .catch(() => {});
  }
}
