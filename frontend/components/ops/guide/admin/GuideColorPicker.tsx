'use client';

import { GUIDE_ACCENT_TOKENS } from '@/components/ops/guide/accent';

interface GuideColorPickerProps {
  value: string | null;
  onChange: (color: string) => void;
}

export function GuideColorPicker({ value, onChange }: GuideColorPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-[14px] font-medium">Accent Color</label>
      <div className="flex flex-wrap gap-2">
        {GUIDE_ACCENT_TOKENS.map(({ label, value: token }) => (
          <button
            key={token}
            type="button"
            aria-pressed={value === token}
            className={`size-7 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
              value === token
                ? 'border-ring ring-2 ring-ring ring-offset-2'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: token }}
            onClick={() => onChange(token)}
            aria-label={label}
          />
        ))}
      </div>
    </div>
  );
}
