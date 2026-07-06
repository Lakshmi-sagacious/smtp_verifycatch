import { promises as dns } from 'dns';

export interface DnsCheckResult {
  ok: boolean;
  detail?: string;
}

// TXT records over 255 chars come back as arrays of chunks — join them into one string
// per record before matching, then flatten all records into a single normalized string.
async function resolveTxtJoined(host: string): Promise<string[]> {
  try {
    const rows = await dns.resolveTxt(host);
    return rows.map((chunks) => chunks.join(''));
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') return [];
    throw err;
  }
}

// DKIM: TXT at <selector>._domainkey.<domain> must contain our expected `p=<base64>`.
export async function checkDkim(
  domain: string,
  selector: string,
  expectedPublicKeyDnsValue: string,
): Promise<DnsCheckResult> {
  const host = `${selector}._domainkey.${domain}`;
  const records = await resolveTxtJoined(host);
  if (records.length === 0) {
    return { ok: false, detail: `No TXT record found at ${host}` };
  }
  const match = records.find((r) => r.replace(/\s+/g, '').includes(`p=${expectedPublicKeyDnsValue}`));
  if (!match) {
    return { ok: false, detail: `TXT at ${host} does not contain the expected p= value` };
  }
  return { ok: true };
}

// SPF: any TXT at <domain> starting with "v=spf1" that references our include.
export async function checkSpf(domain: string, expectedInclude: string): Promise<DnsCheckResult> {
  const records = await resolveTxtJoined(domain);
  const spfRecords = records.filter((r) => r.toLowerCase().startsWith('v=spf1'));
  if (spfRecords.length === 0) {
    return { ok: false, detail: `No v=spf1 TXT record found at ${domain}` };
  }
  const match = spfRecords.find((r) => r.toLowerCase().includes(`include:${expectedInclude.toLowerCase()}`));
  if (!match) {
    return { ok: false, detail: `SPF record does not include ${expectedInclude}` };
  }
  return { ok: true };
}

// DMARC: any TXT at _dmarc.<domain> starting with "v=DMARC1".
export async function checkDmarc(domain: string): Promise<DnsCheckResult> {
  const records = await resolveTxtJoined(`_dmarc.${domain}`);
  const found = records.find((r) => r.toLowerCase().startsWith('v=dmarc1'));
  if (!found) {
    return { ok: false, detail: `No v=DMARC1 TXT record found at _dmarc.${domain}` };
  }
  return { ok: true };
}
