'use client';

import { DynamicIcon } from '@/components/ops/guide/DynamicIcon';

const GUIDE_ICONS = [
  'BookOpen', 'ChefHat', 'ShoppingCart', 'PackageSearch', 'Salad',
  'Truck', 'LayoutDashboard', 'ClipboardList', 'Users', 'Shield',
  'Settings', 'BarChart3', 'Rocket', 'CheckCircle', 'Trophy',
  'Gauge', 'Monitor', 'CalendarDays', 'MessageSquare', 'FolderOpen',
] as const;

interface GuideIconPickerProps {
  value: string | null;
  onChange: (icon: string) => void;
}

export function GuideIconPicker({ value, onChange }: GuideIconPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-[14px] font-medium">Section Icon</label>
      <div className="grid grid-cols-5 gap-2">
        {GUIDE_ICONS.map((iconName) => (
          <button
            key={iconName}
            type="button"
            className={`size-9 rounded-lg border flex items-center justify-center cursor-pointer hover:bg-muted transition-colors ${
              value === iconName
                ? 'bg-primary/10 border-primary'
                : 'border-border'
            }`}
            onClick={() => onChange(iconName)}
            aria-label={iconName}
          >
            <DynamicIcon name={iconName} className="size-5" />
          </button>
        ))}
      </div>
    </div>
  );
}
