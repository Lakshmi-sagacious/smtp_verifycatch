import { generateKeyPairSync, createPublicKey } from 'crypto';

export interface DkimKeypair {
  publicKeyPem: string;
  privateKeyPem: string;
  // Base64 SPKI — the value that goes into DNS after "p=".
  publicKeyDnsValue: string;
}

// 2048-bit RSA: standard for DKIM. 1024 is deprecated, 4096 is rejected by some resolvers due to size.
export function generateDkimKeypair(): DkimKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    publicKeyDnsValue: pemToBase64(publicKey),
  };
}

export function pemToBase64(pem: string): string {
  return createPublicKey(pem)
    .export({ format: 'der', type: 'spki' })
    .toString('base64');
}

export function buildDkimTxtRecord(publicKeyDnsValue: string): string {
  return `v=DKIM1; k=rsa; p=${publicKeyDnsValue}`;
}
