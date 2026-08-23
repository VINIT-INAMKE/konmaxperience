'use client';

import Image from 'next/image';
import { Plus, Minus } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart-store';
import { productImage } from '@/lib/types/catalog';
import type { Product } from '@/lib/types/catalog';

interface ProductOrderCardProps {
  item: Product;
  available: boolean;
}

export function ProductOrderCard({ item, available }: ProductOrderCardProps) {
  const quantity = useCartStore(
    (s) => s.items.find((i) => i.productId === item.id)?.quantity || 0,
  );
  const imageUrl = productImage(item);

  const handleAdd = () => {
    if (!available) return;
    useCartStore.getState().addItem({
      productId: item.id,
      name: item.name,
      unitPrice: item.base_price,
      imageUrl,
    });
  };

  const handleDecrement = () => {
    useCartStore.getState().updateQuantity(item.id, quantity - 1);
  };

  const handleIncrement = () => {
    useCartStore.getState().updateQuantity(item.id, quantity + 1);
  };

  return (
    <div
      className={`flex items-center bg-[var(--public-surface)] rounded-xl border border-[var(--public-border)] px-4 py-3 gap-3 ${
        !available ? 'opacity-60' : ''
      }`}
    >
      {/* Left: info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-[var(--public-fg)] truncate">
          {item.name}
        </h3>
        <p className="text-base font-semibold text-[var(--public-fg)] mt-1">
          &#8377;{item.base_price}
        </p>
      </div>

      {/* Right: image + add/stepper */}
      <div className="w-24 shrink-0 relative">
        <div className="w-24 h-20 rounded-lg overflow-hidden bg-[var(--public-surface)]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.name}
              width={96}
              height={80}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-2xl font-semibold text-[var(--public-muted-warm)]">
                {item.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Add / Stepper control */}
        <div className="absolute -bottom-3 right-0 flex items-center">
          {quantity === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              disabled={!available}
              aria-label={`Add ${item.name} to cart`}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm ${
                available
                  ? 'bg-[var(--public-terracotta)] hover:bg-[var(--public-terracotta-hover)] cursor-pointer'
                  : 'bg-[var(--public-border-light)] cursor-not-allowed'
              }`}
            >
              <Plus className="size-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-[var(--public-terracotta)] text-white rounded-full px-2 py-1 text-sm shadow-sm">
              <button
                type="button"
                onClick={handleDecrement}
                aria-label={`Decrease quantity of ${item.name}`}
                className="min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="min-w-[20px] text-center font-semibold text-sm">
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                aria-label={`Increase quantity of ${item.name}`}
                className="min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
