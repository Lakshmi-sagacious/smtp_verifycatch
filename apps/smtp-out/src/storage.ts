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

export async function putRaw(key: string, body: Buffer): Promise<void> {
  if (useFs) {
    const p = path.join(env.STORAGE_LOCAL_PATH, env.S3_BUCKET_RAW, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
    return;
  }
  await s3!.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_RAW,
      Key: key,
      Body: body,
      ContentType: 'message/rfc822',
    }),
  );
}
