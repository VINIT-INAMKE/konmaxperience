'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  getEvidenceTypeFromMime,
} from '@/lib/types/evidence';

interface PresignResponse {
  presignedUrl: string;
  key: string;
  publicUrl: string;
}

interface EvidenceUploadZoneProps {
  taskId: string;
  onUploadComplete: () => void;
  onShowLinkForm: () => void;
  onShowNoteForm: () => void;
}

export function EvidenceUploadZone({
  taskId,
  onUploadComplete,
  onShowLinkForm,
  onShowNoteForm,
}: EvidenceUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const validateFile = useCallback((file: File): boolean => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error(
        "That file type isn't supported \u2014 try a photo, document, or video.",
      );
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("That file is too large \u2014 keep it under 10 MB.");
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
        // Step 1: Get presigned URL
        const { presignedUrl, publicUrl } =
          await apiClient.post<PresignResponse>('/storage/presign', {
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
            taskId,
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

        // Step 3: Create evidence record
        await apiClient.post(`/tasks/${taskId}/evidence`, {
          type: getEvidenceTypeFromMime(file.type),
          url: publicUrl,
          notes: null,
        });

        onUploadComplete();
      } catch {
        toast.error('Upload failed — check your connection and try again.');
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [taskId, validateFile, onUploadComplete],
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

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        void uploadFile(files[0]);
      }
    },
    [uploadFile],
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
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Evidence upload zone -- drop files here or click to browse"
        className={`relative min-h-[120px] rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-100 cursor-pointer ${
          isDragging
            ? 'border-2 border-solid border-primary bg-muted/50'
            : 'border border-dashed border-border'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
      >
        {isUploading && <BorderBeam size={60} duration={4} />}

        <UploadCloud
          className={`size-6 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}
        />

        {isUploading && uploadProgress !== null ? (
          <div className="flex flex-col items-center gap-1">
            <div className="w-[160px] h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 transition-all duration-200 rounded-full"
                style={{ width: `${uploadProgress}%` }}
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              />
            </div>
            <span className="text-xs text-blue-400">{uploadProgress}%</span>
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
          accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/webm"
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload CTA + link/note buttons */}
      <div className="flex items-center gap-3">
        <ShimmerButton
          className="h-9 text-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          Upload evidence
        </ShimmerButton>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onShowLinkForm}
        >
          Add a link
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onShowNoteForm}
        >
          Add a note
        </Button>
      </div>
    </div>
  );
}
