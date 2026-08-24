'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ImageOff, Play } from 'lucide-react';

import type { ProductMedia } from '@/lib/types/catalog';
import { cn } from '@/lib/utils';

/**
 * The product's media rail.
 *
 * Three things the plan makes non-negotiable:
 *
 * - **`next/image` with `priority` on the first frame.** The hero image is the
 *   LCP element on every product page; letting it lazy-load costs the metric
 *   outright. `next.config.ts` declares the R2 host, so the optimiser can serve
 *   it — but a URL from an *undeclared* host makes `next/image` throw at render,
 *   which would take the whole page down over a bad row. {@link isOptimisable}
 *   degrades those to a plain `<img>` instead.
 * - **Empty media is a real state, not an edge case.** The demo seed carries 12
 *   media rows across 12 products, so most products have none. The fallback is a
 *   token-coloured plate, never a broken-image glyph.
 * - **`kind: 'video'` is honoured.** A video thumbnail carries a play affordance
 *   and the main frame becomes a native `<video controls>`; rendering an MP4
 *   through `next/image` would silently produce nothing.
 *
 * Below `md` the thumbnails are one horizontally-scrolling strip; from `md` up
 * they become the left column of a two-column gallery.
 */
export interface ProductGalleryProps {
  media: ProductMedia[];
  /** Alt text for the frames that carry none of their own. */
  productName: string;
  className?: string;
}

/** `next/image` throws on a host `next.config.ts` does not declare. */
function isOptimisable(url: string): boolean {
  return url.startsWith('https://');
}

function GalleryPlaceholder({ className }: { className?: string }) {
  return (
    <div
      data-slot="product-gallery-placeholder"
      className={cn(
        'flex aspect-square w-full items-center justify-center rounded-2xl border border-line-warm bg-surface-raised',
        className,
      )}
    >
      <ImageOff className="size-10 text-ink-faint" aria-hidden="true" />
      <span className="sr-only">No photograph yet</span>
    </div>
  );
}

function MainFrame({
  item,
  productName,
  isFirst,
}: {
  item: ProductMedia;
  productName: string;
  isFirst: boolean;
}) {
  const alt = item.alt || productName;

  if (item.kind === 'video') {
    return (
      <video
        src={item.url}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
        className="size-full rounded-2xl bg-surface-sunken object-cover"
      />
    );
  }

  if (!isOptimisable(item.url)) {
    // eslint-disable-next-line @next/next/no-img-element -- host is not declared in next.config.ts
    return <img src={item.url} alt={alt} className="size-full rounded-2xl object-cover" />;
  }

  return (
    <Image
      src={item.url}
      alt={alt}
      fill
      priority={isFirst}
      sizes="(min-width: 1024px) 44vw, (min-width: 640px) 70vw, 100vw"
      className="rounded-2xl object-cover"
    />
  );
}

function Thumb({
  item,
  productName,
  isActive,
  onSelect,
}: {
  item: ProductMedia;
  productName: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  const alt = item.alt || productName;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Show ${alt}`}
      aria-current={isActive}
      className={cn(
        'relative size-16 shrink-0 overflow-hidden rounded-xl border bg-surface-raised transition-colors outline-none md:size-20',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        isActive ? 'border-brand' : 'border-line hover:border-line-strong',
      )}
    >
      {item.kind === 'video' || !isOptimisable(item.url) ? (
        <span className="flex size-full items-center justify-center text-ink-muted">
          <Play className="size-4" aria-hidden="true" />
        </span>
      ) : (
        <Image src={item.url} alt="" fill sizes="80px" className="object-cover" />
      )}
    </button>
  );
}

export function ProductGallery({ media, productName, className }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const frames = media;
  const active = frames[Math.min(activeIndex, frames.length - 1)];

  if (frames.length === 0) {
    return <GalleryPlaceholder className={className} />;
  }

  return (
    <div
      data-slot="product-gallery"
      className={cn('flex flex-col gap-3 md:flex-row-reverse md:items-start md:gap-4', className)}
    >
      <div className="relative aspect-square w-full min-w-0 overflow-hidden rounded-2xl border border-line-warm bg-surface-raised md:flex-1">
        <MainFrame item={active} productName={productName} isFirst={activeIndex === 0} />
      </div>

      {frames.length > 1 ? (
        <div
          className={cn(
            'flex gap-2 overflow-x-auto pb-1',
            'md:w-20 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0',
          )}
        >
          {frames.map((item, index) => (
            <Thumb
              key={item.id}
              item={item}
              productName={productName}
              isActive={index === activeIndex}
              onSelect={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
