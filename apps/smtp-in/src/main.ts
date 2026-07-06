import { env } from './config';
import { buildSmtpServer } from './server';
import { prisma } from './db';

async function main() {
  // Fail fast if the DB is unreachable — better than accepting mail we can't store.
  await prisma.$connect();

  const server = buildSmtpServer();
  server.listen(env.SMTP_IN_PORT, env.SMTP_IN_BIND, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[smtp-in] listening on ${env.SMTP_IN_BIND}:${env.SMTP_IN_PORT} — connect with any SMTP client`,
    );
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[smtp-in] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    await prisma.$disconnect();
    // Force-exit if close hangs on stuck sessions.
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[smtp-in] fatal', err);
  process.exit(1);
});
