import { SMTPServer, type SMTPServerAuthentication, type SMTPServerSession } from 'smtp-server';
import { env } from './config';
import { verifySmtpCredential, type AuthedSession } from './auth';
import { storeIncoming } from './store';

interface SessionWithAuth extends SMTPServerSession {
  smtpAuth?: AuthedSession;
}

export function buildSmtpServer(): SMTPServer {
  const server = new SMTPServer({
    banner: env.SMTP_IN_BANNER,
    authOptional: false,
    secure: false, // no STARTTLS in dev; add when we ship prod
    size: env.SMTP_IN_MAX_SIZE_MB * 1024 * 1024,
    disabledCommands: ['STARTTLS'], // avoid confusing clients that expect TLS certs we don't have

    onAuth(auth: SMTPServerAuthentication, session, callback) {
      const s = session as SessionWithAuth;
      const username = auth.username ?? '';
      const password = auth.password ?? '';
      verifySmtpCredential(username, password)
        .then((result) => {
          if (!result) {
            callback(new Error('Invalid credentials'));
            return;
          }
          s.smtpAuth = result;
          callback(null, { user: result.username });
        })
        .catch((err) => callback(err));
    },

    onMailFrom(_address, _session, callback) {
      // Accept any envelope sender — sandbox doesn't police it.
      callback();
    },

    onRcptTo(_address, _session, callback) {
      // Accept any recipient — sandbox routes by SMTP auth, not RCPT TO.
      callback();
    },

    onData(stream, session, callback) {
      const s = session as SessionWithAuth;
      if (!s.smtpAuth) {
        callback(new Error('Not authenticated'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      const max = env.SMTP_IN_MAX_SIZE_MB * 1024 * 1024;
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > max) {
          stream.destroy();
        }
      });
      stream.on('end', () => {
        if (size > max) {
          const err = new Error('Message exceeds size limit');
          (err as any).responseCode = 552;
          callback(err);
          return;
        }
        const raw = Buffer.concat(chunks);
        const clientIp = session.remoteAddress ?? null;
        const rcptTo = session.envelope.rcptTo?.map((r) => r.address) ?? [];
        const mailFrom = session.envelope.mailFrom
          ? session.envelope.mailFrom.address
          : '';

        storeIncoming({
          auth: s.smtpAuth!,
          mailFrom,
          rcptTo,
          clientIp,
          raw,
        })
          .then((res) => {
            callback(null, `Message stored as ${res.messageId}`);
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[smtp-in] store failed', err);
            const wrapped = new Error('Temporary storage error, please retry');
            (wrapped as any).responseCode = 451;
            callback(wrapped);
          });
      });
      stream.on('error', (err) => callback(err));
    },
  });

  server.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[smtp-in] server error', err);
  });

  return server;
}
