import { z } from 'zod';

export const CreateSmtpCredentialSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateSmtpCredentialInput = z.infer<typeof CreateSmtpCredentialSchema>;

export interface SmtpCredentialView {
  id: string;
  name: string;
  username: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// Returned exactly once, on creation.
export interface SmtpCredentialWithSecret extends SmtpCredentialView {
  password: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
}
