import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateWebhookInput, UpdateWebhookInput, WebhookView, WebhookWithSecret } from '@smtp/shared';
import type { EventType } from '@smtp/db';
import { generateToken } from '../common/hash';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string): Promise<WebhookView[]> {
    const rows = await this.prisma.webhook.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toView);
  }

  async create(orgId: string, input: CreateWebhookInput): Promise<WebhookWithSecret> {
    const secret = `whsec_${generateToken(24)}`;
    const row = await this.prisma.webhook.create({
      data: {
        orgId,
        url: input.url,
        events: input.events as EventType[],
        secret,
      },
    });
    return { ...this.toView(row), secret };
  }

  async update(orgId: string, id: string, input: UpdateWebhookInput): Promise<WebhookView> {
    const row = await this.prisma.webhook.findUnique({ where: { id } });
    if (!row || row.orgId !== orgId) throw new NotFoundException('Webhook not found');
    const updated = await this.prisma.webhook.update({
      where: { id },
      data: {
        url: input.url,
        events: input.events ? (input.events as EventType[]) : undefined,
        active: input.active,
      },
    });
    return this.toView(updated);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.webhook.findUnique({ where: { id } });
    if (!row || row.orgId !== orgId) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id } });
  }

  private toView(row: {
    id: string;
    url: string;
    events: EventType[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): WebhookView {
    return {
      id: row.id,
      url: row.url,
      events: row.events as WebhookView['events'],
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
