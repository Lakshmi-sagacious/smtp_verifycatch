import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './config';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const deliveryQueue = new Queue<{ messageId: string; orgId: string }>('deliveries', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const webhookQueue = new Queue<{
  orgId: string;
  messageId: string;
  eventType: string;
  eventId: string;
  occurredAt: string;
}>('webhook-fanout', {
  connection,
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: 5000,
    removeOnFail: 10_000,
  },
});

export async function shutdownQueues() {
  await deliveryQueue.close();
  await webhookQueue.close();
  await connection.quit();
}
