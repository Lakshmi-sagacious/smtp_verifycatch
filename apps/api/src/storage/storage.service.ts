import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { Readable } from 'stream';

type Driver = 'fs' | 's3';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: Driver;
  private readonly localBase: string;
  private client?: S3Client;
  readonly rawBucket: string;
  readonly attachmentBucket: string;

  constructor(private readonly config: ConfigService) {
    this.driver = config.get<string>('STORAGE_DRIVER') === 'fs' ? 'fs' : 's3';
    this.localBase = config.get<string>('STORAGE_LOCAL_PATH') ?? './storage';
    this.rawBucket = config.get<string>('S3_BUCKET_RAW') ?? 'raw-messages';
    this.attachmentBucket = config.get<string>('S3_BUCKET_ATTACHMENTS') ?? 'attachments';

    if (this.driver === 's3') {
      this.client = new S3Client({
        endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
        region: config.getOrThrow<string>('S3_REGION'),
        credentials: {
          accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
          secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
        },
        forcePathStyle: config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE'),
      });
    }
  }

  async onModuleInit() {
    if (this.driver === 's3') {
      await this.ensureBucket(this.rawBucket);
      await this.ensureBucket(this.attachmentBucket);
    } else {
      await fs.mkdir(path.join(this.localBase, this.rawBucket), { recursive: true });
      await fs.mkdir(path.join(this.localBase, this.attachmentBucket), { recursive: true });
      this.logger.log(`Filesystem storage at ${this.localBase}`);
    }
  }

  private async ensureBucket(name: string) {
    try {
      await this.client!.send(new HeadBucketCommand({ Bucket: name }));
    } catch {
      try {
        await this.client!.send(new CreateBucketCommand({ Bucket: name }));
        this.logger.log(`Created bucket ${name}`);
      } catch (err) {
        this.logger.warn(`Could not create bucket ${name}: ${(err as Error).message}`);
      }
    }
  }

  async putRaw(key: string, body: Buffer | Uint8Array): Promise<void> {
    if (this.driver === 'fs') return this.writeLocal(this.rawBucket, key, Buffer.from(body));
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.rawBucket,
        Key: key,
        Body: body,
        ContentType: 'message/rfc822',
      }),
    );
  }

  async putAttachment(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    if (this.driver === 'fs') return this.writeLocal(this.attachmentBucket, key, Buffer.from(body));
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.attachmentBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getRaw(key: string): Promise<Readable> {
    if (this.driver === 'fs') return this.readLocal(this.rawBucket, key);
    const res = await this.client!.send(new GetObjectCommand({ Bucket: this.rawBucket, Key: key }));
    return res.Body as Readable;
  }

  async getAttachment(key: string): Promise<Readable> {
    if (this.driver === 'fs') return this.readLocal(this.attachmentBucket, key);
    const res = await this.client!.send(
      new GetObjectCommand({ Bucket: this.attachmentBucket, Key: key }),
    );
    return res.Body as Readable;
  }

  async deleteRaw(key: string): Promise<void> {
    if (this.driver === 'fs') return this.deleteLocal(this.rawBucket, key);
    await this.client!.send(new DeleteObjectCommand({ Bucket: this.rawBucket, Key: key }));
  }

  async deleteAttachment(key: string): Promise<void> {
    if (this.driver === 'fs') return this.deleteLocal(this.attachmentBucket, key);
    await this.client!.send(new DeleteObjectCommand({ Bucket: this.attachmentBucket, Key: key }));
  }

  private async writeLocal(bucket: string, key: string, body: Buffer): Promise<void> {
    const p = path.join(this.localBase, bucket, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  private readLocal(bucket: string, key: string): Readable {
    return createReadStream(path.join(this.localBase, bucket, key));
  }

  private async deleteLocal(bucket: string, key: string): Promise<void> {
    await fs.unlink(path.join(this.localBase, bucket, key)).catch(() => {});
  }
}
