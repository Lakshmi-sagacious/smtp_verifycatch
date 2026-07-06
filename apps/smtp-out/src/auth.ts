import bcrypt from 'bcryptjs';
import { prisma } from './db';

export interface AuthedSession {
  credentialId: string;
  orgId: string;
  username: string;
}

// Auth for SMTP submission: matches against SmtpCredential (relay), NOT InboxCredential (sandbox).
export async function verifySubmissionCredential(
  username: string,
  password: string,
): Promise<AuthedSession | null> {
  const cred = await prisma.smtpCredential.findUnique({ where: { username } });
  if (!cred || cred.revokedAt) return null;

  const ok = await bcrypt.compare(password, cred.passwordHash);
  if (!ok) return null;

  prisma.smtpCredential
    .update({ where: { id: cred.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { credentialId: cred.id, orgId: cred.orgId, username: cred.username };
}
