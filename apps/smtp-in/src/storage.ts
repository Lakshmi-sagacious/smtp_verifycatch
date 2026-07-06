import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from './config';

const useFs = env.STORAGE_DRIVER === 'fs';

const s3 = useFs
  ? null
  : new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY ?? '',
        secretAccessKey: env.S3_SECRET_KEY ?? '',
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });

async function writeLocal(bucket: string, key: string, body: Buffer): Promise<void> {
  const p = path.join(env.STORAGE_LOCAL_PATH, bucket, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

export async function putRaw(key: string, body: Buffer): Promise<void> {
  if (useFs) return writeLocal(env.S3_BUCKET_RAW, key, body);
  await s3!.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_RAW,
      Key: key,
      Body: body,
      ContentType: 'message/rfc822',
    }),
  );
}

export async function putAttachment(key: string, body: Buffer, contentType: string): Promise<void> {
  if (useFs) return writeLocal(env.S3_BUCKET_ATTACHMENTS, key, body);
  await s3!.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_ATTACHMENTS,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
