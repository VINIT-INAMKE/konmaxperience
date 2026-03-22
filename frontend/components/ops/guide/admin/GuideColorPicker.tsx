'use client';

const GUIDE_COLORS = [
  '#9E7AFF', '#FE8BBB', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#64748b',
];

interface GuideColorPickerProps {
  value: string | null;
  onChange: (color: string) => void;
}

export function GuideColorPicker({ value, onChange }: GuideColorPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-[14px] font-medium">Accent Color</label>
      <div className="flex flex-wrap gap-2">
        {GUIDE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`size-7 rounded-full cursor-pointer border-2 hover:scale-110 transition-transform ${
              value === color
                ? 'border-ring ring-2 ring-ring ring-offset-2'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`Color ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
