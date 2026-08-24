'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { reportError } from '@/lib/report-error';
import type { ProductMedia } from '@/lib/types/catalog';

/**
 * Mirrors `PresignProductMediaDto` exactly: the DTO's `@IsIn` list and
 * `StorageService.validatePresignRequest`'s 10 MB ceiling. Checking here means a
 * bad file fails before the round trip rather than after it.
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = ALLOWED_TYPES.join(',');

interface PresignResponse {
  presignedUrl: string;
  key: string;
  publicUrl: string;
}

type Stage = 'idle' | 'presigning' | 'uploading' | 'linking';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeFile(file: File): string | null {
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} is a ${file.type || 'unknown'} file. Product media must be JPEG, PNG or WebP.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  if (file.size < 1) return `${file.name} is empty.`;
  return null;
}

/**
 * `fetch` cannot report upload progress, and a 10 MB image on a villa
 * connection is long enough that a spinner with no number reads as a hang.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`The storage bucket rejected the upload (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () =>
      reject(new Error('The upload could not reach the storage bucket. Check the connection.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(file);
  });
}

interface MediaUploaderProps {
  productId: string;
  /** Appended to the end of the gallery, so it never steals the cover slot. */
  nextSortOrder: number;
  disabled: boolean;
  onUploaded: () => void;
}

export function MediaUploader({
  productId,
  nextSortOrder,
  disabled,
  onUploaded,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  // The object URL outlives the render that created it, so it is revoked when
  // the preview changes or the component goes away.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const isBusy = stage !== 'idle';

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setAlt('');
    setPercent(0);
    setError(null);
    setStage('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = describeFile(candidate);
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    setError(null);
    setFile(candidate);
    setPreviewUrl(URL.createObjectURL(candidate));
  };

  const handleUpload = async () => {
    if (!file) return;
    const altText = alt.trim();
    if (!altText) {
      setError('Alt text is required — it is what the storefront gallery and the OG card read out.');
      return;
    }

    setError(null);
    setPercent(0);
    try {
      setStage('presigning');
      const presigned = await apiClient.post<PresignResponse>('/storage/presign-product-media', {
        productId,
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
      });

      setStage('uploading');
      await putWithProgress(presigned.presignedUrl, file, setPercent);

      setStage('linking');
      await apiClient.post<ProductMedia>(`/catalog/products/${productId}/media`, {
        url: presigned.publicUrl,
        alt: altText,
        kind: 'image',
        sort_order: nextSortOrder,
      });

      toast.success('Image added.');
      reset();
      onUploaded();
    } catch (err) {
      reportError(err, { scope: 'MediaUploader.upload', productId, stage });
      const msg = err instanceof Error ? err.message : 'The upload failed.';
      setError(msg);
      toast.error(msg);
      setStage('idle');
      setPercent(0);
    }
  };

  const stageLabel =
    stage === 'presigning'
      ? 'Requesting an upload slot...'
      : stage === 'uploading'
        ? `Uploading... ${percent}%`
        : stage === 'linking'
          ? 'Linking it to the product...'
          : null;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => acceptFile(e.target.files?.[0])}
        disabled={disabled || isBusy}
      />

      {!file ? (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none',
            isDropTarget ? 'border-line-strong bg-surface-raised' : undefined,
            disabled ? 'opacity-60' : undefined,
          )}
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            setIsDropTarget(true);
          }}
          onDragLeave={() => setIsDropTarget(false)}
          onDrop={(e) => {
            if (disabled) return;
            e.preventDefault();
            setIsDropTarget(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
        >
          <ImagePlus className="size-7 text-ink-faint" />
          <p className="text-sm font-medium">Drop an image, or pick one</p>
          <p className="text-xs text-ink-muted">
            JPEG, PNG or WebP · up to {formatBytes(MAX_FILE_BYTES)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs px-3"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            Choose image
          </Button>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-line-strong bg-surface-raised p-3 space-y-3">
          <div className="flex items-start gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {previewUrl && (
                // A blob: URL has no remote host for the optimiser to fetch, so
                // this preview is a plain <img>. Everything already stored goes
                // through next/image in MediaThumb.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-ink-muted">
                {file.type.replace('image/', '').toUpperCase()} · {formatBytes(file.size)}
              </p>
            </div>
            <button
              type="button"
              className="p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-destructive disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              onClick={reset}
              disabled={isBusy}
              aria-label="Discard this image"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="media-upload-alt" className="text-xs">
              Alt text (required)
            </Label>
            <Input
              id="media-upload-alt"
              className="h-8 text-sm"
              placeholder="Sourdough loaf, sliced, on a wooden board"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              disabled={isBusy}
            />
            <p className="text-[11px] leading-tight text-ink-faint">
              Describe the photo. The storefront gallery, the product card and the share preview all
              read this.
            </p>
          </div>

          {stageLabel && (
            <div className="space-y-1.5">
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                {stageLabel}
              </p>
              {stage === 'uploading' && <Progress value={percent} />}
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs px-3"
              onClick={() => void handleUpload()}
              disabled={isBusy || !alt.trim()}
            >
              {isBusy ? (
                <Loader2 className="size-3.5 mr-1 animate-spin motion-reduce:animate-none" />
              ) : (
                <Upload className="size-3.5 mr-1" />
              )}
              Upload image
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-3"
              onClick={reset}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
