import { randomBytes } from 'crypto';
import type { SendMessageInput } from '@smtp/shared';

// Build a minimal RFC 5322 message from structured input. This is the pre-DKIM MIME —
// the mailer worker fetches it from object storage, signs it with the domain's key, and delivers.
export function composeMime(input: SendMessageInput, messageIdHost: string): { raw: Buffer; messageIdHeader: string } {
  const messageIdHeader = `<${randomBytes(12).toString('hex')}@${messageIdHost}>`;
  const now = new Date().toUTCString().replace('GMT', '+0000');

  const headers: string[] = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    `Date: ${now}`,
    `Message-ID: ${messageIdHeader}`,
    'MIME-Version: 1.0',
  ];
  if (input.replyTo) headers.push(`Reply-To: ${input.replyTo}`);
  if (input.headers) {
    for (const [name, value] of Object.entries(input.headers)) {
      // Skip user attempts to override headers we set ourselves.
      if (isReservedHeader(name)) continue;
      headers.push(`${name}: ${value}`);
    }
  }

  let body: string;
  if (input.text && input.html) {
    const boundary = `----smtp_${randomBytes(8).toString('hex')}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body =
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n\r\n` +
      `${input.text}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n\r\n` +
      `${input.html}\r\n` +
      `--${boundary}--\r\n`;
  } else if (input.html) {
    headers.push('Content-Type: text/html; charset=utf-8');
    headers.push('Content-Transfer-Encoding: 8bit');
    body = `\r\n${input.html}\r\n`;
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8');
    headers.push('Content-Transfer-Encoding: 8bit');
    body = `\r\n${input.text ?? ''}\r\n`;
  }

  const raw = Buffer.from(headers.join('\r\n') + '\r\n' + body, 'utf-8');
  return { raw, messageIdHeader };
}

const RESERVED = new Set(['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'content-type', 'content-transfer-encoding', 'reply-to', 'dkim-signature']);
function isReservedHeader(name: string): boolean {
  return RESERVED.has(name.toLowerCase());
}
