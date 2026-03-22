'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingInputProps {
  value: number;
  onChange: (v: number) => void;
}

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number>(0);

  return (
    <div className="flex flex-row gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={
                filled
                  ? 'size-8 fill-amber-500 text-amber-500'
                  : 'size-8 fill-none text-gray-300'
              }
            />
          </button>
        );
      })}
    </div>
  );
}
