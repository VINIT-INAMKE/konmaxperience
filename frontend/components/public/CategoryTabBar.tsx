'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { ProductCategory } from '@/lib/types/catalog';

interface CategoryTabBarProps {
  categories: ProductCategory[];
  activeCategoryId: string;
  onCategoryClick: (id: string) => void;
}

export function CategoryTabBar({
  categories,
  activeCategoryId,
  onCategoryClick,
}: CategoryTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view in the tab bar
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeCategoryId]);

  const handleClick = useCallback(
    (id: string) => {
      onCategoryClick(id);
      const el = document.getElementById(`category-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [onCategoryClick],
  );

  if (categories.length === 0) return null;

  return (
    <div className="sticky top-14 z-9 h-12 bg-[var(--public-bg)] border-b border-[var(--public-border-light)] flex items-center">
      <div
        ref={scrollRef}
        className="flex gap-2 px-4 overflow-x-auto scrollbar-hide w-full"
      >
        {categories.map((cat) => {
          const isActive = cat.id === activeCategoryId;
          return (
            <button
              key={cat.id}
              ref={isActive ? activeTabRef : undefined}
              type="button"
              onClick={() => handleClick(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                isActive
                  ? 'bg-[var(--public-terracotta)] text-[var(--accent-ink)]'
                  : 'bg-[var(--public-surface)] text-[var(--public-fg-subtle)] border border-[var(--public-border)]'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
