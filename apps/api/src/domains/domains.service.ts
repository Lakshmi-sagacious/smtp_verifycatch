import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CreateDomainInput, DnsRecord, DomainView } from '@smtp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { buildDkimTxtRecord, generateDkimKeypair, pemToBase64 } from './dkim';
import { checkDkim, checkDmarc, checkSpf } from './dns-check';

@Injectable()
export class DomainsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async list(orgId: string): Promise<DomainView[]> {
    const domains = await this.prisma.domain.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map((d) => this.toView(d));
  }

  async get(orgId: string, id: string): Promise<DomainView> {
    const d = await this.getOrThrow(orgId, id);
    return this.toView(d);
  }

  async create(orgId: string, input: CreateDomainInput): Promise<DomainView> {
    const existing = await this.prisma.domain.findUnique({
      where: { orgId_name: { orgId, name: input.name } },
    });
    if (existing) throw new ConflictException('Domain already added');

    const selector = this.config.get<string>('DKIM_SELECTOR') ?? 'smtp';
    const spfInclude = this.config.get<string>('PLATFORM_SPF_INCLUDE') ?? 'spf.smtp-platform.local';
    const kp = generateDkimKeypair();

    const created = await this.prisma.domain.create({
      data: {
        orgId,
        name: input.name,
        dkimSelector: selector,
        dkimPublicKey: kp.publicKeyPem,
        // WARNING: plaintext in dev — see schema.prisma comment for the KMS migration.
        dkimPrivateKey: kp.privateKeyPem,
        spfExpected: `v=spf1 include:${spfInclude} ~all`,
      },
    });
    return this.toView(created);
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.getOrThrow(orgId, id);
    await this.prisma.domain.delete({ where: { id } });
  }

  async verify(orgId: string, id: string): Promise<DomainView> {
    const domain = await this.getOrThrow(orgId, id);
    const spfInclude = this.config.get<string>('PLATFORM_SPF_INCLUDE') ?? 'spf.smtp-platform.local';
    const skipDns = this.config.get<boolean>('DEV_SKIP_DNS_CHECK') ?? false;
    const now = new Date();

    // Dev bypass — force VERIFIED so local integration testing works without real DNS.
    // Env schema refuses to enable this in NODE_ENV=production.
    if (skipDns) {
      const updated = await this.prisma.domain.update({
        where: { id: domain.id },
        data: { lastCheckedAt: now, verifiedAt: now, verificationStatus: 'VERIFIED' },
      });
      const stub = { ok: true, detail: 'DEV_SKIP_DNS_CHECK=true — DNS not actually checked' };
      return this.toView(updated, { dkim: stub, spf: stub, dmarc: stub });
    }

    const publicKeyDnsValue = pemToBase64(domain.dkimPublicKey);
    // Only DKIM is strictly required for delivery + signing to work — SPF and DMARC are advisory.
    // We still check them so the UI can nudge users to add them.
    const [dkim, spf, dmarc] = await Promise.all([
      checkDkim(domain.name, domain.dkimSelector, publicKeyDnsValue),
      checkSpf(domain.name, spfInclude),
      checkDmarc(domain.name),
    ]);

    const updated = await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        lastCheckedAt: now,
        verifiedAt: dkim.ok ? now : null,
        verificationStatus: dkim.ok ? 'VERIFIED' : 'FAILED',
      },
    });

    return this.toView(updated, { dkim, spf, dmarc });
  }

  private toView(
    d: {
      id: string;
      name: string;
      verificationStatus: string;
      dkimSelector: string;
      dkimPublicKey: string;
      spfExpected: string;
      verifiedAt: Date | null;
      lastCheckedAt: Date | null;
      createdAt: Date;
    },
    checks?: {
      dkim: { ok: boolean; detail?: string };
      spf: { ok: boolean; detail?: string };
      dmarc: { ok: boolean; detail?: string };
    },
  ): DomainView {
    const publicKeyDnsValue = pemToBase64(d.dkimPublicKey);
    const dnsRecords: DnsRecord[] = [
      {
        type: 'TXT',
        host: `${d.dkimSelector}._domainkey.${d.name}`,
        value: buildDkimTxtRecord(publicKeyDnsValue),
        purpose: 'DKIM',
        status: checks?.dkim.ok
          ? 'VERIFIED'
          : checks
            ? 'FAILED'
            : d.verificationStatus === 'VERIFIED'
              ? 'VERIFIED'
              : 'PENDING',
        detail: checks?.dkim.detail,
      },
      {
        type: 'TXT',
        host: d.name,
        value: d.spfExpected,
        purpose: 'SPF',
        status: checks?.spf.ok ? 'VERIFIED' : checks ? 'FAILED' : 'PENDING',
        detail: checks?.spf.detail,
      },
      {
        type: 'TXT',
        host: `_dmarc.${d.name}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${d.name}`,
        purpose: 'DMARC',
        status: checks?.dmarc.ok ? 'VERIFIED' : checks ? 'RECOMMENDED' : 'RECOMMENDED',
        detail: checks?.dmarc.detail,
      },
    ];

    return {
      id: d.id,
      name: d.name,
      verificationStatus: d.verificationStatus as DomainView['verificationStatus'],
      dkimSelector: d.dkimSelector,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      dnsRecords,
    };
  }

  private async getOrThrow(orgId: string, id: string) {
    const d = await this.prisma.domain.findUnique({ where: { id } });
    if (!d || d.orgId !== orgId) throw new NotFoundException('Domain not found');
    return d;
  }
}
