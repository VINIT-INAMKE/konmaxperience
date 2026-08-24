'use client';

import { useCartStore } from '@/lib/stores/cart-store';

interface FloatingCartBarProps {
  onViewCart: () => void;
}

export function FloatingCartBar({ onViewCart }: FloatingCartBarProps) {
  const items = useCartStore((s) => s.items);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const isVisible = totalItems > 0;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-[var(--public-cart-bar)] text-[var(--public-cart-bar-fg)] h-16 flex items-center justify-between px-4 shadow-lg transition-all duration-200 ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      {/* Left: item count chip + summary */}
      <div className="flex items-center">
        <span
          aria-live="polite"
          className="bg-[var(--public-terracotta)] text-[var(--accent-ink)] text-xs font-bold px-2 py-1 rounded mr-3"
        >
          {totalItems}
        </span>
        <span className="text-sm font-medium text-[var(--public-cart-bar-fg)]">
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Right: total + CTA */}
      <div className="flex items-center">
        <span className="text-base font-semibold text-[var(--public-cart-bar-fg)] mr-4">
          &#8377;{subtotal.toFixed(0)}
        </span>
        <button
          type="button"
          onClick={onViewCart}
          className="bg-[var(--public-terracotta)] text-[var(--accent-ink)] text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer hover:bg-[var(--public-terracotta-hover)] transition-colors"
        >
          View Cart
        </button>
      </div>
    </div>
  );
}
