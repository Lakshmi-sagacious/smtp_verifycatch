import { SMTPServer, type SMTPServerAuthentication, type SMTPServerSession } from 'smtp-server';
import { env } from './config';
import { verifySubmissionCredential, type AuthedSession } from './auth';
import { acceptSubmission, DomainNotVerifiedError } from './store';

interface SessionWithAuth extends SMTPServerSession {
  smtpAuth?: AuthedSession;
}

export function buildSmtpServer(): SMTPServer {
  const server = new SMTPServer({
    banner: env.SMTP_OUT_BANNER,
    authOptional: false,
    secure: false,
    size: env.SMTP_OUT_MAX_SIZE_MB * 1024 * 1024,
    disabledCommands: ['STARTTLS'],

    onAuth(auth: SMTPServerAuthentication, session, callback) {
      const s = session as SessionWithAuth;
      const username = auth.username ?? '';
      const password = auth.password ?? '';
      verifySubmissionCredential(username, password)
        .then((result) => {
          if (!result) return callback(new Error('Invalid credentials'));
          s.smtpAuth = result;
          callback(null, { user: result.username });
        })
        .catch((err) => callback(err));
    },

    onMailFrom(_address, _session, callback) {
      // Domain check happens after DATA, when we can persist a message row for audit.
      callback();
    },

    onRcptTo(_address, _session, callback) {
      callback();
    },

    onData(stream, session, callback) {
      const s = session as SessionWithAuth;
      if (!s.smtpAuth) return callback(new Error('Not authenticated'));

      const chunks: Buffer[] = [];
      let size = 0;
      const max = env.SMTP_OUT_MAX_SIZE_MB * 1024 * 1024;
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > max) stream.destroy();
      });
      stream.on('end', () => {
        if (size > max) {
          const err = new Error('Message exceeds size limit');
          (err as any).responseCode = 552;
          return callback(err);
        }
        const raw = Buffer.concat(chunks);
        const clientIp = session.remoteAddress ?? null;
        const rcptTo = session.envelope.rcptTo?.map((r) => r.address) ?? [];
        const mailFrom = session.envelope.mailFrom ? session.envelope.mailFrom.address : '';

        acceptSubmission({ auth: s.smtpAuth!, mailFrom, rcptTo, clientIp, raw })
          .then((res) => callback(null, `Queued as ${res.messageId}`))
          .catch((err) => {
            if (err instanceof DomainNotVerifiedError) {
              const e = new Error(`5.7.1 Sending domain ${err.domain} is not verified`);
              (e as any).responseCode = 550;
              return callback(e);
            }
            // eslint-disable-next-line no-console
            console.error('[smtp-out] submission failed', err);
            const wrapped = new Error('Temporary error, retry');
            (wrapped as any).responseCode = 451;
            callback(wrapped);
          });
      });
      stream.on('error', (err) => callback(err));
    },
  });

  server.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[smtp-out] server error', err);
  });

  return server;
}
