import bcrypt from 'bcryptjs';
import { prisma } from './db';

export interface AuthedSession {
  credentialId: string;
  inboxId: string;
  orgId: string;
  username: string;
}

// Return null on any failure — caller maps to SMTP 535 to avoid leaking user existence.
export async function verifySmtpCredential(
  username: string,
  password: string,
): Promise<AuthedSession | null> {
  const cred = await prisma.inboxCredential.findUnique({
    where: { username },
    include: { inbox: { select: { id: true, orgId: true, deletedAt: true } } },
  });
  if (!cred || cred.revokedAt || cred.inbox.deletedAt) return null;

  const ok = await bcrypt.compare(password, cred.passwordHash);
  if (!ok) return null;

  // Fire and forget — don't hold up SMTP handshake.
  prisma.inboxCredential
    .update({ where: { id: cred.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    credentialId: cred.id,
    inboxId: cred.inbox.id,
    orgId: cred.inbox.orgId,
    username: cred.username,
  };
}
