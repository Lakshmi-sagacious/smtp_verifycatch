import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { EventType } from '@smtp/db';
import { PrismaService } from '../prisma/prisma.service';
import { WEBHOOK_QUEUE_TOKEN, type WebhookFanoutJobData } from '../queues/queues.module';

// Centralized MessageEvent + webhook fanout. Every place that transitions message state
// should call this instead of writing to prisma.messageEvent directly, so webhook fires stay
// consistent.
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBHOOK_QUEUE_TOKEN) private readonly webhookQueue: Queue<WebhookFanoutJobData>,
  ) {}

  async record(params: {
    messageId: string;
    orgId: string;
    type: EventType;
    detail?: unknown;
  }): Promise<void> {
    const event = await this.prisma.messageEvent.create({
      data: {
        messageId: params.messageId,
        type: params.type,
        detail: params.detail as any,
      },
    });
    await this.webhookQueue.add(
      'fanout',
      {
        orgId: params.orgId,
        messageId: params.messageId,
        eventType: params.type,
        eventId: event.id,
        occurredAt: event.occurredAt.toISOString(),
      },
      { jobId: event.id }, // idempotent
    );
  }
}
