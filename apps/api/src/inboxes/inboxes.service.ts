import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateCredentialInput, CreateInboxInput, UpdateInboxInput } from '@smtp/shared';
import { ConfigService } from '@nestjs/config';
import { generateToken, hashPassword } from '../common/hash';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InboxesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async list(orgId: string) {
    const rows = await this.prisma.inbox.findMany({
      where: { orgId, deletedAt: null },
      include: { _count: { select: { messages: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      color: i.color,
      createdAt: i.createdAt.toISOString(),
      messageCount: i._count.messages,
    }));
  }

  async get(orgId: string, id: string) {
    const inbox = await this.getOrThrow(orgId, id);
    const count = await this.prisma.message.count({ where: { inboxId: id } });
    return {
      id: inbox.id,
      name: inbox.name,
      description: inbox.description,
      color: inbox.color,
      createdAt: inbox.createdAt.toISOString(),
      messageCount: count,
    };
  }

  async create(orgId: string, input: CreateInboxInput) {
    const inbox = await this.prisma.inbox.create({
      data: {
        orgId,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
      },
    });
    // Auto-provision one credential so the user can immediately connect.
    await this.createCredential(orgId, inbox.id, { label: 'default' });
    return {
      id: inbox.id,
      name: inbox.name,
      description: inbox.description,
      color: inbox.color,
      createdAt: inbox.createdAt.toISOString(),
      messageCount: 0,
    };
  }

  async update(orgId: string, id: string, input: UpdateInboxInput) {
    await this.getOrThrow(orgId, id);
    const inbox = await this.prisma.inbox.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
      },
    });
    return {
      id: inbox.id,
      name: inbox.name,
      description: inbox.description,
      color: inbox.color,
      createdAt: inbox.createdAt.toISOString(),
      messageCount: 0,
    };
  }

  async softDelete(orgId: string, id: string) {
    await this.getOrThrow(orgId, id);
    await this.prisma.inbox.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listCredentials(orgId: string, inboxId: string) {
    await this.getOrThrow(orgId, inboxId);
    const rows = await this.prisma.inboxCredential.findMany({
      where: { inboxId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => ({
      id: c.id,
      username: c.username,
      label: c.label,
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      revokedAt: c.revokedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async createCredential(orgId: string, inboxId: string, input: CreateCredentialInput) {
    await this.getOrThrow(orgId, inboxId);
    // Human-friendly username prefix, sufficiently random suffix.
    const username = `inbox_${generateToken(6)}`;
    const password = generateToken(16); // 32 hex chars
    const passwordHash = await hashPassword(password);
    const cred = await this.prisma.inboxCredential.create({
      data: {
        inboxId,
        username,
        passwordHash,
        label: input.label ?? null,
      },
    });
    return {
      id: cred.id,
      username: cred.username,
      label: cred.label,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: cred.createdAt.toISOString(),
      password, // returned ONCE — hash is in DB
      smtp: {
        host: this.config.get<string>('SMTP_IN_HOST') ?? 'localhost',
        port: Number(this.config.get<string>('SMTP_IN_PORT') ?? 2525),
        secure: false,
      },
    };
  }

  async revokeCredential(orgId: string, inboxId: string, credId: string) {
    await this.getOrThrow(orgId, inboxId);
    const cred = await this.prisma.inboxCredential.findUnique({ where: { id: credId } });
    if (!cred || cred.inboxId !== inboxId) throw new NotFoundException('Credential not found');
    await this.prisma.inboxCredential.update({
      where: { id: credId },
      data: { revokedAt: new Date() },
    });
  }

  private async getOrThrow(orgId: string, id: string) {
    const inbox = await this.prisma.inbox.findUnique({ where: { id } });
    if (!inbox || inbox.orgId !== orgId || inbox.deletedAt) {
      throw new NotFoundException('Inbox not found');
    }
    return inbox;
  }
}
