import { Injectable, BadRequestException } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createR2Client } from './r2.config';

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
  private readonly s3 = createR2Client();
  private readonly bucketName = process.env.R2_BUCKET_NAME || 'konma-evidence';

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
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
}
