import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import { randomBytes } from 'crypto';
import { prisma } from './db';
import { putRaw } from './storage';
import { deliveryQueue, webhookQueue } from './queue';
import type { AuthedSession } from './auth';

export interface StoreOptions {
  auth: AuthedSession;
  mailFrom: string;
  rcptTo: string[];
  clientIp: string | null;
  raw: Buffer;
}

export interface StoreResult {
  messageId: string;
}

export class DomainNotVerifiedError extends Error {
  constructor(readonly domain: string) {
    super(`Domain ${domain} is not verified for this org`);
  }
}

export async function acceptSubmission(opts: StoreOptions): Promise<StoreResult> {
  // 1. From-domain must be VERIFIED for this org.
  const fromDomain = extractDomain(opts.mailFrom);
  if (!fromDomain) throw new DomainNotVerifiedError(opts.mailFrom);

  const domain = await prisma.domain.findUnique({
    where: { orgId_name: { orgId: opts.auth.orgId, name: fromDomain } },
  });
  if (!domain || domain.verificationStatus !== 'VERIFIED') {
    throw new DomainNotVerifiedError(fromDomain);
  }

  // 2. Parse for metadata (subject, headers, bodies). The RAW MIME is what actually gets sent.
  const parsed = await simpleParser(opts.raw);

  // 3. Suppression filter — drop suppressed recipients up front.
  const suppressions = await prisma.suppressionEntry.findMany({
    where: { orgId: opts.auth.orgId, email: { in: opts.rcptTo } },
    select: { email: true },
  });
  const suppressedSet = new Set(suppressions.map((s) => s.email));
  const deliverable = opts.rcptTo.filter((r) => !suppressedSet.has(r));
  if (deliverable.length === 0) {
    // Persist as REJECTED for audit but skip enqueue.
    const rejected = await prisma.message.create({
      data: {
        orgId: opts.auth.orgId,
        domainId: domain.id,
        kind: 'RELAY_OUTBOUND',
        status: 'REJECTED',
        mailFrom: opts.mailFrom,
        rcptTo: opts.rcptTo,
        fromAddress: pickFirstAddress(parsed.from),
        toAddresses: allAddresses(parsed.to),
        ccAddresses: allAddresses(parsed.cc),
        bccAddresses: allAddresses(parsed.bcc),
        subject: parsed.subject ?? null,
        messageIdHeader: parsed.messageId ?? null,
        headers: flattenHeaders(parsed),
        textBody: parsed.text ?? null,
        htmlBody: typeof parsed.html === 'string' ? parsed.html : null,
        hasAttachments: (parsed.attachments?.length ?? 0) > 0,
        sizeBytes: opts.raw.length,
        rawStorageKey: '',
        smtpAuthUser: opts.auth.username,
        clientIp: opts.clientIp,
      },
    });
    await emit(opts.auth.orgId, rejected.id, 'REJECTED', {
      reason: 'all-recipients-suppressed',
      suppressed: Array.from(suppressedSet),
    });
    return { messageId: rejected.id };
  }

  // 4. Store raw + create Message + fire RECEIVED/QUEUED events + enqueue.
  const rawKey = `${opts.auth.orgId}/${randomBytes(12).toString('hex')}.eml`;
  await putRaw(rawKey, opts.raw);

  const message = await prisma.message.create({
    data: {
      orgId: opts.auth.orgId,
      domainId: domain.id,
      kind: 'RELAY_OUTBOUND',
      status: 'QUEUED',
      mailFrom: opts.mailFrom,
      rcptTo: deliverable,
      fromAddress: pickFirstAddress(parsed.from),
      toAddresses: allAddresses(parsed.to),
      ccAddresses: allAddresses(parsed.cc),
      bccAddresses: allAddresses(parsed.bcc),
      subject: parsed.subject ?? null,
      messageIdHeader: parsed.messageId ?? null,
      headers: flattenHeaders(parsed),
      textBody: parsed.text ?? null,
      htmlBody: typeof parsed.html === 'string' ? parsed.html : null,
      hasAttachments: (parsed.attachments?.length ?? 0) > 0,
      sizeBytes: opts.raw.length,
      rawStorageKey: rawKey,
      smtpAuthUser: opts.auth.username,
      clientIp: opts.clientIp,
    },
  });

  await emit(opts.auth.orgId, message.id, 'RECEIVED');
  await emit(opts.auth.orgId, message.id, 'QUEUED');

  await deliveryQueue.add(
    'deliver',
    { messageId: message.id, orgId: opts.auth.orgId },
    { jobId: message.id },
  );

  return { messageId: message.id };
}

async function emit(orgId: string, messageId: string, type: string, detail?: unknown) {
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
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  return at < 0 ? null : email.slice(at + 1).toLowerCase();
}
function pickFirstAddress(addr: AddressObject | AddressObject[] | undefined): string | null {
  if (!addr) return null;
  const list = Array.isArray(addr) ? addr : [addr];
  for (const a of list) {
    const first = a.value?.[0]?.address;
    if (first) return first;
  }
  return null;
}
function allAddresses(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return [];
  const list = Array.isArray(addr) ? addr : [addr];
  const out: string[] = [];
  for (const a of list) for (const v of a.value ?? []) if (v.address) out.push(v.address);
  return out;
}
function flattenHeaders(parsed: ParsedMail): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  parsed.headerLines?.forEach((h) => {
    const idx = h.line.indexOf(':');
    if (idx < 0) return;
    out.push({ name: h.line.slice(0, idx).trim(), value: h.line.slice(idx + 1).trim() });
  });
  return out;
}
