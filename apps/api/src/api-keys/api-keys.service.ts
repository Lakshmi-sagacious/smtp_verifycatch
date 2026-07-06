import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiKeyView, ApiKeyWithSecret, CreateApiKeyInput } from '@smtp/shared';
import { generateToken, sha256 } from '../common/hash';
import { PrismaService } from '../prisma/prisma.service';

const KEY_PREFIX_LEN = 12; // e.g. "smtp_live_a1"
const KEY_SECRET_BYTES = 24; // 48 hex chars after the prefix

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string): Promise<ApiKeyView[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(this.toView);
  }

  async create(
    orgId: string,
    createdById: string,
    input: CreateApiKeyInput,
  ): Promise<ApiKeyWithSecret> {
    const secret = generateToken(KEY_SECRET_BYTES);
    const key = `smtp_live_${secret}`;
    const keyPrefix = key.slice(0, KEY_PREFIX_LEN);
    const keyHash = sha256(key);

    const row = await this.prisma.apiKey.create({
      data: {
        orgId,
        name: input.name,
        keyPrefix,
        keyHash,
        scopes: input.scopes,
        createdById,
      },
    });

    return {
      ...this.toView(row),
      key, // returned exactly once
    };
  }

  async revoke(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!row || row.orgId !== orgId) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  // Hot-path lookup used by the send endpoint's API-key guard.
  async findByKey(key: string) {
    const row = await this.prisma.apiKey.findUnique({
      where: { keyHash: sha256(key) },
    });
    if (!row || row.revokedAt) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;
    return row;
  }

  async markUsed(id: string) {
    await this.prisma.apiKey
      .update({ where: { id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  private toView(row: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): ApiKeyView {
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
