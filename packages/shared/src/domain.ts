import { z } from 'zod';

// A verifiable domain name — allow subdomains, disallow protocols/paths.
const domainNameRegex = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export const CreateDomainSchema = z.object({
  name: z.string().toLowerCase().regex(domainNameRegex, 'Invalid domain name'),
});
export type CreateDomainInput = z.infer<typeof CreateDomainSchema>;

export type DomainVerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'DISABLED';

export interface DnsRecord {
  type: 'TXT' | 'CNAME' | 'MX';
  host: string;
  value: string;
  purpose: 'DKIM' | 'SPF' | 'DMARC' | 'RETURN_PATH';
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'RECOMMENDED';
  // Human-readable "we expected X but saw Y" — populated after verification.
  detail?: string;
}

export interface DomainView {
  id: string;
  name: string;
  verificationStatus: DomainVerificationStatus;
  dkimSelector: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  dnsRecords: DnsRecord[];
}
