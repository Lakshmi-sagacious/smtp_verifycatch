import { Injectable, NotFoundException } from '@nestjs/common';
import type { MessageDetail, MessageListResponse, MessageSummary } from '@smtp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  async listForInbox(
    orgId: string,
    inboxId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<MessageListResponse> {
    await this.assertInbox(orgId, inboxId);
    const take = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const rows = await this.prisma.message.findMany({
      where: { orgId, inboxId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items: items.map(this.toSummary),
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async get(orgId: string, id: string): Promise<MessageDetail> {
    const msg = await this.prisma.message.findUnique({
      where: { id },
      include: {
        attachments: true,
        events: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!msg || msg.orgId !== orgId) throw new NotFoundException('Message not found');
    return {
      id: msg.id,
      kind: msg.kind,
      status: msg.status,
      mailFrom: msg.mailFrom,
      rcptTo: msg.rcptTo,
      fromAddress: msg.fromAddress,
      toAddresses: msg.toAddresses,
      ccAddresses: msg.ccAddresses,
      bccAddresses: msg.bccAddresses,
      subject: msg.subject,
      messageIdHeader: msg.messageIdHeader,
      inReplyTo: msg.inReplyTo,
      headers: normalizeHeaders(msg.headers),
      textBody: msg.textBody,
      htmlBody: msg.htmlBody,
      hasAttachments: msg.hasAttachments,
      sizeBytes: msg.sizeBytes,
      smtpAuthUser: msg.smtpAuthUser,
      clientIp: msg.clientIp,
      createdAt: msg.createdAt.toISOString(),
      attachments: msg.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        contentId: a.contentId,
      })),
      events: msg.events.map((e) => ({
        id: e.id,
        type: e.type,
        detail: e.detail,
        occurredAt: e.occurredAt.toISOString(),
      })),
    };
  }

  async listForOrg(
    orgId: string,
    filters: {
      cursor?: string;
      limit?: number;
      kind?: 'SANDBOX_INBOUND' | 'RELAY_OUTBOUND';
      status?: string;
      domainId?: string;
      inboxId?: string;
      q?: string;
    },
  ) {
    const take = Math.min(Math.max(filters.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const where: any = { orgId };
    if (filters.kind) where.kind = filters.kind;
    if (filters.status) where.status = filters.status;
    if (filters.domainId) where.domainId = filters.domainId;
    if (filters.inboxId) where.inboxId = filters.inboxId;
    if (filters.q) {
      const q = filters.q.trim();
      if (q) {
        where.OR = [
          { subject: { contains: q, mode: 'insensitive' } },
          { fromAddress: { contains: q, mode: 'insensitive' } },
          { toAddresses: { has: q.toLowerCase() } },
        ];
      }
    }
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items: items.map(this.toSummary),
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async getRawStream(orgId: string, id: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id },
      select: { id: true, orgId: true, rawStorageKey: true, subject: true },
    });
    if (!msg || msg.orgId !== orgId) throw new NotFoundException('Message not found');
    const stream = await this.storage.getRaw(msg.rawStorageKey);
    return { stream, filename: `${msg.id}.eml` };
  }

  async getAttachmentStream(orgId: string, messageId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { message: { select: { orgId: true, id: true } } },
    });
    if (
      !attachment ||
      attachment.messageId !== messageId ||
      attachment.message.orgId !== orgId
    ) {
      throw new NotFoundException('Attachment not found');
    }
    const stream = await this.storage.getAttachment(attachment.storageKey);
    return { stream, filename: attachment.filename, contentType: attachment.contentType };
  }

  async delete(orgId: string, id: string): Promise<void> {
    const msg = await this.prisma.message.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!msg || msg.orgId !== orgId) throw new NotFoundException('Message not found');

    // Best-effort object storage cleanup — DB row is truth. If S3 fails we still delete the row.
    await Promise.allSettled([
      this.storage.deleteRaw(msg.rawStorageKey),
      ...msg.attachments.map((a) => this.storage.deleteAttachment(a.storageKey)),
    ]);
    await this.prisma.message.delete({ where: { id } });
  }

  private toSummary = (m: {
    id: string;
    fromAddress: string | null;
    toAddresses: string[];
    subject: string | null;
    sizeBytes: number;
    hasAttachments: boolean;
    createdAt: Date;
  }): MessageSummary => ({
    id: m.id,
    fromAddress: m.fromAddress,
    toAddresses: m.toAddresses,
    subject: m.subject,
    sizeBytes: m.sizeBytes,
    hasAttachments: m.hasAttachments,
    createdAt: m.createdAt.toISOString(),
  });

  private async assertInbox(orgId: string, inboxId: string) {
    const inbox = await this.prisma.inbox.findUnique({
      where: { id: inboxId },
      select: { orgId: true, deletedAt: true },
    });
    if (!inbox || inbox.orgId !== orgId || inbox.deletedAt) {
      throw new NotFoundException('Inbox not found');
    }
  }
}

// Headers may be stored as Prisma Json — normalize to a stable array shape for the UI.
function normalizeHeaders(raw: unknown): Array<{ name: string; value: string }> {
  if (Array.isArray(raw)) {
    return raw
      .filter((h): h is { name: string; value: unknown } => !!h && typeof h === 'object' && 'name' in h)
      .map((h) => ({ name: String(h.name), value: String(h.value ?? '') }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([name, value]) => ({
      name,
      value: Array.isArray(value) ? value.join(', ') : String(value ?? ''),
    }));
  }
  return [];
}
