import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './config';
import { prisma } from './db';
import { fanout } from './deliver';

async function main() {
  await prisma.$connect();
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<{
    orgId: string;
    messageId: string;
    eventType: string;
    eventId: string;
    occurredAt: string;
  }>(
    'webhook-fanout',
    async (job: Job) => fanout(job.data),
    {
      connection,
      concurrency: env.WEBHOOKS_CONCURRENCY,
    },
  );

  worker.on('completed', (job) =>
    // eslint-disable-next-line no-console
    console.log(`[webhooks] delivered fanout ${job.data.eventType} for ${job.data.messageId}`),
  );
  worker.on('failed', (job, err) =>
    // eslint-disable-next-line no-console
    console.error(`[webhooks] failed fanout attempt ${job?.attemptsMade}: ${err.message}`),
  );

  // eslint-disable-next-line no-console
  console.log(`[webhooks] worker running, concurrency=${env.WEBHOOKS_CONCURRENCY}`);

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[webhooks] ${signal} received, draining`);
    await worker.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[webhooks] fatal', err);
  process.exit(1);
});
