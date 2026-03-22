import { apiClient } from '@/lib/api-client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export class ImageUploadError extends Error {
  constructor(
    public code: 'INVALID_TYPE' | 'TOO_LARGE' | 'UPLOAD_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

export function validateImageFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new ImageUploadError(
      'INVALID_TYPE',
      'Only JPEG, PNG, and WebP images are supported.',
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ImageUploadError(
      'TOO_LARGE',
      'Image must be smaller than 10 MB.',
    );
  }
}

export async function uploadImageToR2(file: File): Promise<string> {
  validateImageFile(file);

  // 1. Request presigned URL from backend
  const { presignedUrl, publicUrl } = await apiClient.post<{
    presignedUrl: string;
    key: string;
    publicUrl: string;
  }>('/storage/presign-guide', {
    filename: file.name,
    contentType: file.type,
    fileSize: file.size,
  });

  // 2. PUT directly to R2
  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!uploadResponse.ok) {
    throw new ImageUploadError(
      'UPLOAD_FAILED',
      'Image upload failed. Try again or use a different file.',
    );
  }

  return publicUrl;
}
