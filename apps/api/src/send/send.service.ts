import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { SendMessageInput, SendMessageResponse } from '@smtp/shared';
import { randomBytes } from 'crypto';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EventsService } from '../events/events.service';
import { DELIVERY_QUEUE_TOKEN, type DeliveryJobData } from '../queues/queues.module';
import { composeMime } from './mime';

@Injectable()
export class SendService {
  private readonly logger = new Logger(SendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventsService,
    @Inject(DELIVERY_QUEUE_TOKEN) private readonly deliveryQueue: Queue<DeliveryJobData>,
  ) {}

  async send(orgId: string, input: SendMessageInput): Promise<SendMessageResponse> {
    // 1. Verify From domain is verified for this org
    const fromDomain = extractDomain(input.from);
    if (!fromDomain) throw new BadRequestException('Invalid From address');

    const domain = await this.prisma.domain.findUnique({
      where: { orgId_name: { orgId, name: fromDomain } },
    });
    if (!domain) {
      throw new ForbiddenException(`Sending domain ${fromDomain} is not registered for this org`);
    }
    if (domain.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenException(`Sending domain ${fromDomain} is not verified`);
    }

    // 2. Suppression check
    const suppressed = await this.prisma.suppressionEntry.findUnique({
      where: { orgId_email: { orgId, email: input.to } },
    });
    if (suppressed) {
      const msg = await this.prisma.message.create({
        data: {
          orgId,
          domainId: domain.id,
          kind: 'RELAY_OUTBOUND',
          status: 'REJECTED',
          mailFrom: input.from,
          rcptTo: [input.to],
          fromAddress: input.from,
          toAddresses: [input.to],
          ccAddresses: [],
          bccAddresses: [],
          subject: input.subject,
          headers: [],
          textBody: input.text ?? null,
          htmlBody: input.html ?? null,
          hasAttachments: false,
          sizeBytes: 0,
          rawStorageKey: '',
        },
      });
      await this.events.record({
        orgId,
        messageId: msg.id,
        type: 'REJECTED',
        detail: { reason: 'suppressed', suppressionReason: suppressed.reason },
      });
      return { messageId: msg.id, status: 'REJECTED', reason: `Recipient is suppressed (${suppressed.reason})` };
    }

    // 3. Compose + upload + insert + enqueue
    const { raw, messageIdHeader } = composeMime(input, fromDomain);
    const rawKey = `${orgId}/${randomBytes(12).toString('hex')}.eml`;
    await this.storage.putRaw(rawKey, raw);

    const message = await this.prisma.message.create({
      data: {
        orgId,
        domainId: domain.id,
        kind: 'RELAY_OUTBOUND',
        status: 'QUEUED',
        mailFrom: input.from,
        rcptTo: [input.to],
        fromAddress: input.from,
        toAddresses: [input.to],
        ccAddresses: [],
        bccAddresses: [],
        subject: input.subject,
        messageIdHeader,
        headers: [],
        textBody: input.text ?? null,
        htmlBody: input.html ?? null,
        hasAttachments: false,
        sizeBytes: raw.length,
        rawStorageKey: rawKey,
      },
    });

    await this.events.record({ orgId, messageId: message.id, type: 'RECEIVED' });
    await this.events.record({ orgId, messageId: message.id, type: 'QUEUED' });

    await this.deliveryQueue.add(
      'deliver',
      { messageId: message.id, orgId },
      { jobId: message.id },
    );

    this.logger.log(`queued ${message.id} for ${input.to}`);
    return { messageId: message.id, status: 'QUEUED' };
  }
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}
