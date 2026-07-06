import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
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

export async function getRawMime(key: string): Promise<Buffer> {
  if (useFs) {
    const stream = createReadStream(path.join(env.STORAGE_LOCAL_PATH, env.S3_BUCKET_RAW, key));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  const res = await s3!.send(new GetObjectCommand({ Bucket: env.S3_BUCKET_RAW, Key: key }));
  const body = res.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
