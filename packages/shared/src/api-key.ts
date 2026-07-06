import { z } from 'zod';

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  // For MVP every key gets ["send"]. Kept as array so we can widen later without breaking clients.
  scopes: z.array(z.enum(['send'])).min(1).default(['send']),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

export interface ApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// Returned exactly once, at creation time.
export interface ApiKeyWithSecret extends ApiKeyView {
  key: string;
}
