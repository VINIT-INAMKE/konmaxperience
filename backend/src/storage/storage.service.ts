import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createR2Client } from './r2.config';

/** The S3 `DeleteObjects` API rejects a batch larger than this. */
export const DELETE_BATCH_LIMIT = 1000;

/** One object as the orphan sweep needs it: its key and when it was last written. */
export interface StoredObject {
  key: string;
  lastModified: Date | null;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'video/webm',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const required = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'] as const;
    for (const key of required) {
      if (!this.config.get<string>(key)) {
        throw new Error(`Missing required env var: ${key}`);
      }
    }

    this.s3 = createR2Client({
      endpoint: this.config.get<string>('R2_ENDPOINT')!,
      accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!,
      secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!,
    });
    this.bucketName = this.config.get<string>('R2_BUCKET_NAME')!;
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL') || '';
  }

  validatePresignRequest(contentType: string, fileSize: number): void {
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      throw new BadRequestException(
        `Content type "${contentType}" is not allowed. Allowed types: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size ${fileSize} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (10 MB)`,
      );
    }
  }

  buildStorageKey(taskId: string, filename: string): string {
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `evidence/${taskId}/${timestamp}-${sanitized}`;
  }

  async generatePresignedPutUrl(
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 900 });
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Upload a buffer directly to R2 (server-initiated uploads only).
   * Bypasses validatePresignRequest — no MIME whitelist or size check.
   */
  async putObjectDirect(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  }

  /**
   * Lists every key under a prefix, following the S3 continuation token.
   *
   * `ListObjectsV2` caps a page at 1000 keys and signals more with
   * `IsTruncated`; stopping at the first page would make the orphan sweep think
   * a bucket's tail did not exist. Used only by that sweep (RUN-06).
   */
  async listKeys(prefix: string): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of page.Contents ?? []) {
        if (!item.Key) continue;
        objects.push({
          key: item.Key,
          lastModified: item.LastModified ?? null,
        });
      }

      // `NextContinuationToken` is only meaningful while truncated; treating a
      // stale token as live would loop the same page forever.
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return objects;
  }

  /**
   * Deletes keys in chunks of {@link DELETE_BATCH_LIMIT} (the S3 batch limit),
   * returning how many the API reported as deleted. Used only by the orphan
   * sweep (RUN-06) — every other deletion in this system is a database write.
   */
  async deleteKeys(keys: string[]): Promise<number> {
    let deleted = 0;

    for (let i = 0; i < keys.length; i += DELETE_BATCH_LIMIT) {
      const chunk = keys.slice(i, i + DELETE_BATCH_LIMIT);
      if (chunk.length === 0) continue;

      const result = await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );

      // `Quiet: true` suppresses the per-key success list, so a quiet response
      // means "all of them minus whatever came back as an error".
      const errors = result.Errors?.length ?? 0;
      deleted += chunk.length - errors;
    }

    return deleted;
  }
}
