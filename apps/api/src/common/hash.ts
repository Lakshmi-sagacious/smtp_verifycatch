import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

const BCRYPT_COST = 12;

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, BCRYPT_COST);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// Fast hash for hot-path lookups: API keys, refresh tokens, verification tokens.
// Never use for passwords — no salt, no work factor.
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// Cryptographically secure random hex string. Default 32 bytes = 256 bits.
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
