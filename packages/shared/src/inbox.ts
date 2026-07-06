import { z } from 'zod';

export const CreateInboxSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
export type CreateInboxInput = z.infer<typeof CreateInboxSchema>;

export const UpdateInboxSchema = CreateInboxSchema.partial();
export type UpdateInboxInput = z.infer<typeof UpdateInboxSchema>;

export const CreateCredentialSchema = z.object({
  label: z.string().max(80).optional(),
});
export type CreateCredentialInput = z.infer<typeof CreateCredentialSchema>;

export interface InboxView {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  messageCount: number;
}

export interface CredentialView {
  id: string;
  username: string;
  label: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// Only returned once, on credential creation. Password is bcrypt-hashed after — no way to fetch it later.
export interface CredentialWithSecret extends CredentialView {
  password: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
}
