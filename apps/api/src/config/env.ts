import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Storage: pick 'fs' for local filesystem OR 's3' for S3/MinIO. S3_* only required when driver=s3.
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
  SMTP_IN_HOST: z.string().default('localhost'),
  SMTP_IN_PORT: z.coerce.number().int().positive().default(2525),
  SMTP_OUT_HOST: z.string().default('localhost'),
  SMTP_OUT_PORT: z.coerce.number().int().positive().default(587),
  // Public identity of *this* platform — used in SPF include record text shown to users.
  PLATFORM_SPF_INCLUDE: z.string().default('spf.smtp-platform.local'),
  // DKIM selector reused across all domains — cheap for MVP, rotate via a new selector later.
  DKIM_SELECTOR: z.string().default('smtp'),
  // DEV ONLY: bypass real DNS lookups on domain verification, mark VERIFIED unconditionally.
  // Rejected at boot when NODE_ENV=production so we never accidentally ship this.
  DEV_SKIP_DNS_CHECK: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
})
.refine((v) => !(v.DEV_SKIP_DNS_CHECK && v.NODE_ENV === 'production'), {
  message: 'DEV_SKIP_DNS_CHECK cannot be true in production',
  path: ['DEV_SKIP_DNS_CHECK'],
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    // Fail fast + loud so misconfig is obvious in dev.
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
