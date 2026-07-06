import { env } from './config';
import { prisma } from './db';
import { startWorker } from './worker';

async function main() {
  await prisma.$connect();
  const { worker, connection, webhookQueue } = startWorker();

  const target = env.MAILER_RELAY_HOST
    ? `relay ${env.MAILER_RELAY_HOST}:${env.MAILER_RELAY_PORT} (real inbox delivery via upstream)`
    : env.MAILER_OUTBOUND_TARGET
      ? `dev target ${env.MAILER_OUTBOUND_TARGET} (nothing leaves this machine)`
      : 'live MX lookup (needs port 25 outbound + good IP reputation)';
  // eslint-disable-next-line no-console
  console.log(`[mailer] worker running, concurrency=${env.MAILER_CONCURRENCY}, ${target}`);

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[mailer] ${signal} received, draining`);
    await worker.close();
    await webhookQueue.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[mailer] fatal', err);
  process.exit(1);
});
