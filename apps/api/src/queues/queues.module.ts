import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const DELIVERY_QUEUE = 'deliveries';
export const WEBHOOK_QUEUE = 'webhook-fanout';
export const REDIS_CLIENT = 'REDIS_CLIENT';
export const DELIVERY_QUEUE_TOKEN = 'DELIVERY_QUEUE_TOKEN';
export const WEBHOOK_QUEUE_TOKEN = 'WEBHOOK_QUEUE_TOKEN';

export interface DeliveryJobData {
  messageId: string;
  orgId: string;
}

export interface WebhookFanoutJobData {
  orgId: string;
  messageId: string;
  eventType: string;
  eventId: string;
  occurredAt: string;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('REDIS_URL');
        return new IORedis(url, { maxRetriesPerRequest: null });
      },
      inject: [ConfigService],
    },
    {
      provide: DELIVERY_QUEUE_TOKEN,
      useFactory: (redis: IORedis) =>
        new Queue<DeliveryJobData>(DELIVERY_QUEUE, {
          connection: redis,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        }),
      inject: [REDIS_CLIENT],
    },
    {
      provide: WEBHOOK_QUEUE_TOKEN,
      useFactory: (redis: IORedis) =>
        new Queue<WebhookFanoutJobData>(WEBHOOK_QUEUE, {
          connection: redis,
          defaultJobOptions: {
            attempts: 8,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: 5000,
            removeOnFail: 10_000,
          },
        }),
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [REDIS_CLIENT, DELIVERY_QUEUE_TOKEN, WEBHOOK_QUEUE_TOKEN],
})
export class QueuesModule {}
