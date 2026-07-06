import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import path from 'path';

loadEnv({ path: path.resolve(__dirname, '../../../.env') });
loadEnv({ path: path.resolve(__dirname, '../.env'), override: false });

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  WEBHOOKS_CONCURRENCY: z.coerce.number().int().positive().default(10),
  WEBHOOKS_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}
export const env = parsed.data;
