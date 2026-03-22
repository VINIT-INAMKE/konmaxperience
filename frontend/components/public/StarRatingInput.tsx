'use client';

import { useRef, useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingInputProps {
  value: number;
  onChange: (v: number) => void;
}

const STARS = [1, 2, 3, 4, 5] as const;

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number>(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusedIndex = value > 0 ? value - 1 : 0;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = (index + 1) % STARS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = (index - 1 + STARS.length) % STARS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = STARS.length - 1;
    } else {
      return;
    }

    refs.current[next]?.focus();
    onChange(STARS[next]);
  };

  return (
    <div
      className="flex flex-row gap-1"
      role="radiogroup"
      aria-label="Rating"
    >
      {STARS.map((star, index) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            tabIndex={index === focusedIndex ? 0 : -1}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <Star
              aria-hidden="true"
              className={
                filled
                  ? 'size-8 fill-amber-500 text-amber-500'
                  : 'size-8 fill-none text-muted-foreground/40'
              }
            />
          </button>
        );
      })}
    </div>
  );
}
