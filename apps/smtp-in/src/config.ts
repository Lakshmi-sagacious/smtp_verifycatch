import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Try repo root .env first (matches API convention), then service-local.
loadEnv({ path: path.resolve(__dirname, '../../../.env') });
loadEnv({ path: path.resolve(__dirname, '../.env'), override: false });

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SMTP_IN_PORT: z.coerce.number().int().positive().default(2525),
  SMTP_IN_BIND: z.string().default('0.0.0.0'),
  SMTP_IN_MAX_SIZE_MB: z.coerce.number().int().positive().default(25),
  SMTP_IN_BANNER: z.string().default('SMTP Platform sandbox'),
  STORAGE_DRIVER: z.enum(['fs', 's3']).default('s3'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_RAW: z.string().default('raw-messages'),
  S3_BUCKET_ATTACHMENTS: z.string().default('attachments'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
