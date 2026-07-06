import { promises as dns } from 'dns';
import nodemailer from 'nodemailer';
import type { Domain, Message } from '@smtp/db';
import { env } from './config';
import { getRawMime } from './storage';

export interface DeliveryResult {
  status: 'DELIVERED' | 'BOUNCED' | 'DEFERRED';
  response?: string;
  code?: string;
  category?: 'HARD_BOUNCE' | 'SOFT_BOUNCE' | 'CONNECTION' | 'AUTH' | 'OTHER';
  hostAttempted?: string;
}

export async function deliverOne(
  message: Message,
  domain: Domain,
  recipient: string,
): Promise<DeliveryResult> {
  const raw = await getRawMime(message.rawStorageKey);
  const target = await pickTarget(recipient);
  if (!target) {
    return {
      status: 'BOUNCED',
      category: 'HARD_BOUNCE',
      response: `No route to ${recipient} (no relay, no dev target, no MX)`,
    };
  }

  const transporter = nodemailer.createTransport({
    host: target.host,
    port: target.port,
    secure: target.secure,
    ignoreTLS: target.kind === 'dev',
    requireTLS: target.kind === 'relay' && !target.secure,
    auth: target.auth,
    connectionTimeout: env.MAILER_CONNECTION_TIMEOUT_MS,
    greetingTimeout: env.MAILER_CONNECTION_TIMEOUT_MS,
    socketTimeout: env.MAILER_CONNECTION_TIMEOUT_MS,
    ...(target.kind !== 'dev' && {
      dkim: {
        domainName: domain.name,
        keySelector: domain.dkimSelector,
        privateKey: domain.dkimPrivateKey,
      },
    }),
  });

  try {
    const info = await transporter.sendMail({
      envelope: { from: message.mailFrom, to: recipient },
      raw,
    });
    return { status: 'DELIVERED', response: info.response, hostAttempted: target.host };
  } catch (err: any) {
    return classifyError(err, target.host);
  } finally {
    transporter.close();
  }
}

// Priority-ordered target picker:
//   1. `relay` — MAILER_RELAY_HOST set: send via authenticated upstream (Gmail/Brevo/SES/etc)
//   2. `dev`   — MAILER_OUTBOUND_TARGET set: sink to MailHog or similar, no auth
//   3. `mx`    — normal RFC 5321 MX lookup on the recipient's domain
type Target = {
  kind: 'relay' | 'dev' | 'mx';
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
};

async function pickTarget(recipient: string): Promise<Target | null> {
  if (env.MAILER_RELAY_HOST) {
    return {
      kind: 'relay',
      host: env.MAILER_RELAY_HOST,
      port: env.MAILER_RELAY_PORT,
      secure: env.MAILER_RELAY_SECURE,
      auth: env.MAILER_RELAY_USER
        ? { user: env.MAILER_RELAY_USER, pass: env.MAILER_RELAY_PASS ?? '' }
        : undefined,
    };
  }
  if (env.MAILER_OUTBOUND_TARGET) {
    const [h, p] = env.MAILER_OUTBOUND_TARGET.split(':');
    return { kind: 'dev', host: h, port: Number(p) || 25, secure: false };
  }
  const at = recipient.lastIndexOf('@');
  if (at < 0) return null;
  const rcptDomain = recipient.slice(at + 1);
  try {
    const mxs = await dns.resolveMx(rcptDomain);
    if (mxs.length === 0) return { kind: 'mx', host: rcptDomain, port: 25, secure: false };
    mxs.sort((a, b) => a.priority - b.priority);
    return { kind: 'mx', host: mxs[0]!.exchange, port: 25, secure: false };
  } catch {
    return null;
  }
}

function classifyError(err: any, hostAttempted: string): DeliveryResult {
  const code: string = err?.code ?? '';
  const responseCode: number | undefined = err?.responseCode;
  const response: string = err?.response ?? err?.message ?? String(err);

  if (typeof responseCode === 'number' && responseCode >= 500 && responseCode < 600) {
    return { status: 'BOUNCED', code, category: 'HARD_BOUNCE', response, hostAttempted };
  }
  if (typeof responseCode === 'number' && responseCode >= 400 && responseCode < 500) {
    return { status: 'DEFERRED', code, category: 'SOFT_BOUNCE', response, hostAttempted };
  }
  if (code === 'EAUTH') {
    // Auth against the relay failed — treat as terminal, this won't fix on retry.
    return { status: 'BOUNCED', code, category: 'AUTH', response, hostAttempted };
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENOTFOUND') {
    return { status: 'DEFERRED', code, category: 'CONNECTION', response, hostAttempted };
  }
  return { status: 'DEFERRED', code, category: 'OTHER', response, hostAttempted };
}
