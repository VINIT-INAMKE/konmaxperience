'use client';

interface ChannelToggleProps {
  value: 'takeaway' | 'delivery' | null;
  onChange: (channel: 'takeaway' | 'delivery') => void;
}

export function ChannelToggle({ value, onChange }: ChannelToggleProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('takeaway')}
        className={`flex-1 py-2 text-sm font-medium text-center rounded-lg cursor-pointer transition-colors ${
          value === 'takeaway'
            ? 'bg-[var(--public-terracotta)] text-[var(--accent-ink)]'
            : 'bg-[var(--public-surface)] text-[var(--public-fg-subtle)] border border-[var(--public-border)]'
        }`}
      >
        Pickup
      </button>
      <button
        type="button"
        onClick={() => onChange('delivery')}
        className={`flex-1 py-2 text-sm font-medium text-center rounded-lg cursor-pointer transition-colors ${
          value === 'delivery'
            ? 'bg-[var(--public-terracotta)] text-[var(--accent-ink)]'
            : 'bg-[var(--public-surface)] text-[var(--public-fg-subtle)] border border-[var(--public-border)]'
        }`}
      >
        Delivery
      </button>
    </div>
  );
}
