import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import path from 'path';

loadEnv({ path: path.resolve(__dirname, '../../../.env') });
loadEnv({ path: path.resolve(__dirname, '../.env'), override: false });

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  STORAGE_DRIVER: z.enum(['fs', 's3']).default('s3'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_RAW: z.string().default('raw-messages'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  // If set (host:port) the mailer routes ALL outbound to this address instead of doing MX lookup.
  // Used in dev to sink into MailHog. Unset in prod → real MX-based delivery.
  MAILER_OUTBOUND_TARGET: z.string().optional(),
  // Smart-host / relay: route all mail through an authenticated upstream SMTP (Gmail, Brevo, SES,
  // Postmark, Mailgun, etc). If MAILER_RELAY_HOST is set, it takes priority over MX lookup AND
  // over MAILER_OUTBOUND_TARGET. This is how you get real inbox delivery from localhost.
  MAILER_RELAY_HOST: z.string().optional(),
  MAILER_RELAY_PORT: z.coerce.number().int().positive().default(587),
  MAILER_RELAY_USER: z.string().optional(),
  MAILER_RELAY_PASS: z.string().optional(),
  // "true" for implicit TLS (port 465), "false" for STARTTLS on 587. Nodemailer default.
  MAILER_RELAY_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  MAILER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MAILER_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  DKIM_SELECTOR: z.string().default('smtp'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}
export const env = parsed.data;
