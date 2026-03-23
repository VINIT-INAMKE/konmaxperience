'use client';

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  return (
    <Dialog open={imageUrl !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 border-none bg-transparent shadow-none">
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Attachment"
            className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
