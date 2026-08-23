'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { ASSET_ALLOWED_MIME_TYPES, ASSET_MAX_FILE_SIZE } from '@/lib/types/asset';

interface PresignResponse {
  presignedUrl: string;
  key: string;
  publicUrl: string;
}

interface AssetUploadZoneProps {
  onFileReady: (file: File, publicUrl: string) => void;
  disabled?: boolean;
}

export function AssetUploadZone({ onFileReady, disabled }: AssetUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const validateFile = useCallback((file: File): boolean => {
    if (!ASSET_ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error('Upload failed. Check your file type and size (max 10 MB) and try again.');
      return false;
    }
    if (file.size > ASSET_MAX_FILE_SIZE) {
      toast.error('Upload failed. Check your file type and size (max 10 MB) and try again.');
      return false;
    }
    return true;
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!validateFile(file)) return;

      setIsUploading(true);
      setUploadProgress(0);

      try {
        // Step 1: Get presigned URL (no taskId for assets)
        const { presignedUrl, publicUrl } =
          await apiClient.post<PresignResponse>('/storage/presign-asset', {
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
          });

        // Step 2: XHR PUT to presigned URL with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(pct);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed.'));
          });

          xhr.send(file);
        });

        // Step 3: Notify parent — parent handles POST /assets record creation
        onFileReady(file, publicUrl);
      } catch {
        toast.error('Upload failed. Check your file type and size (max 10 MB) and try again.');
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [validateFile, onFileReady],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled || isUploading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        void uploadFile(files[0]);
      }
    },
    [uploadFile, disabled, isUploading],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        void uploadFile(files[0]);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [uploadFile],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Asset upload zone — drop files here or click to browse"
        className={`relative min-h-[120px] rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-100 motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
          isDragging
            ? 'border-2 border-solid border-brand bg-muted/50'
            : 'border border-dashed border-line'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
      >
        <UploadCloud
          className={`size-6 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}
        />

        {isUploading && uploadProgress !== null ? (
          <div className="flex flex-col items-center gap-1">
            <div className="w-[160px] h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-info-status transition-all duration-200 motion-reduce:transition-none rounded-full"
                style={{ width: `${uploadProgress}%` }}
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              />
            </div>
            <span className="text-xs text-info-status">{uploadProgress}%</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-center">Drop files here, or click to browse</p>
            <p className="text-xs text-muted-foreground text-center">
              Photos, documents, video up to 10 MB
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          disabled={disabled || isUploading}
          accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/webm"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}
