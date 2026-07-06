import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CreateSmtpCredentialInput, SmtpCredentialView, SmtpCredentialWithSecret } from '@smtp/shared';
import { generateToken, hashPassword } from '../common/hash';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SmtpCredentialsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async list(orgId: string): Promise<SmtpCredentialView[]> {
    const rows = await this.prisma.smtpCredential.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toView);
  }

  async create(orgId: string, input: CreateSmtpCredentialInput): Promise<SmtpCredentialWithSecret> {
    const username = `smtp_${generateToken(6)}`;
    const password = generateToken(16);
    const passwordHash = await hashPassword(password);

    const row = await this.prisma.smtpCredential.create({
      data: { orgId, name: input.name, username, passwordHash },
    });

    return {
      ...this.toView(row),
      password,
      smtp: {
        host: this.config.get<string>('SMTP_OUT_HOST') ?? 'localhost',
        port: Number(this.config.get<string>('SMTP_OUT_PORT') ?? 587),
        secure: false,
      },
    };
  }

  async revoke(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.smtpCredential.findUnique({ where: { id } });
    if (!row || row.orgId !== orgId) throw new NotFoundException('Credential not found');
    await this.prisma.smtpCredential.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  private toView(row: {
    id: string;
    name: string;
    username: string;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): SmtpCredentialView {
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
