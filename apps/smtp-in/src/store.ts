import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser';
import { randomBytes } from 'crypto';
import { prisma } from './db';
import { putAttachment, putRaw } from './storage';
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

// Parse the raw MIME, upload the raw + attachments, then insert Message+Attachments+Events
// atomically. If either upload OR the DB insert fails, we bail — no orphaned rows.
export async function storeIncoming(opts: StoreOptions): Promise<StoreResult> {
  const parsed = await simpleParser(opts.raw);

  const messageId = cuidLike();
  const rawKey = `${opts.auth.orgId}/${messageId}.eml`;

  await putRaw(rawKey, opts.raw);

  const attachmentUploads = await Promise.all(
    (parsed.attachments ?? []).map(async (att, idx) => {
      const filename = att.filename ?? `attachment-${idx + 1}`;
      const key = `${opts.auth.orgId}/${messageId}/${idx}-${sanitize(filename)}`;
      await putAttachment(key, att.content, att.contentType ?? 'application/octet-stream');
      return {
        filename,
        contentType: att.contentType ?? 'application/octet-stream',
        sizeBytes: att.size ?? att.content.length,
        storageKey: key,
        contentId: att.cid ?? null,
      };
    }),
  );

  const headers = flattenHeaders(parsed);

  const created = await prisma.message.create({
    data: {
      orgId: opts.auth.orgId,
      inboxId: opts.auth.inboxId,
      kind: 'SANDBOX_INBOUND',
      status: 'STORED',
      mailFrom: opts.mailFrom,
      rcptTo: opts.rcptTo,
      fromAddress: pickFirstAddress(parsed.from),
      toAddresses: allAddresses(parsed.to),
      ccAddresses: allAddresses(parsed.cc),
      bccAddresses: allAddresses(parsed.bcc),
      subject: parsed.subject ?? null,
      messageIdHeader: parsed.messageId ?? null,
      inReplyTo: parsed.inReplyTo ?? null,
      headers,
      textBody: parsed.text ?? null,
      htmlBody: typeof parsed.html === 'string' ? parsed.html : null,
      hasAttachments: attachmentUploads.length > 0,
      sizeBytes: opts.raw.length,
      rawStorageKey: rawKey,
      smtpAuthUser: opts.auth.username,
      clientIp: opts.clientIp,
      attachments: {
        create: attachmentUploads,
      },
      events: {
        create: [
          { type: 'RECEIVED' },
          { type: 'STORED' },
        ],
      },
    },
  });

  return { messageId: created.id };
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
  for (const a of list) {
    for (const v of a.value ?? []) {
      if (v.address) out.push(v.address);
    }
  }
  return out;
}

function flattenHeaders(parsed: ParsedMail): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  parsed.headerLines?.forEach((h) => {
    // headerLines gives us the original wire format — split on first colon.
    const idx = h.line.indexOf(':');
    if (idx < 0) return;
    out.push({ name: h.line.slice(0, idx).trim(), value: h.line.slice(idx + 1).trim() });
  });
  return out;
}

function sanitize(filename: string): string {
  return filename.replace(/[^\w.\-]+/g, '_').slice(0, 100);
}

// We don't have access to Prisma's cuid() from here; a random-hex id serves the
// same purpose for building storage keys. The DB row still uses its own default cuid.
function cuidLike(): string {
  return randomBytes(12).toString('hex');
}
