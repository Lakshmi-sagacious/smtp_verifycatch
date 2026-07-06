import { env } from './config';
import { buildSmtpServer } from './server';
import { prisma } from './db';
import { shutdownQueues } from './queue';

async function main() {
  await prisma.$connect();
  const server = buildSmtpServer();
  server.listen(env.SMTP_OUT_PORT, env.SMTP_OUT_BIND, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[smtp-out] listening on ${env.SMTP_OUT_BIND}:${env.SMTP_OUT_PORT} — submit outbound mail here`,
    );
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[smtp-out] ${signal} received, draining`);
    server.close(() => {});
    await shutdownQueues();
    await prisma.$disconnect();
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[smtp-out] fatal', err);
  process.exit(1);
});
