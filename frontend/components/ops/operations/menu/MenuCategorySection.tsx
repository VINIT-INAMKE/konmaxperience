'use client';

import { useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MenuItemCard } from './MenuItemCard';
import type { MenuCategory, MenuItem } from '@/lib/types/menu';

interface MenuCategorySectionProps {
  category: MenuCategory;
  items: MenuItem[];
  isAdmin: boolean;
  onAddItem: (categoryId: string) => void;
  onEditItem: (item: MenuItem) => void;
  onRemoveItem: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem, available: boolean) => Promise<void>;
  onEditCategory: (category: MenuCategory) => void;
  onDeleteCategory: (category: MenuCategory) => void;
}

export function MenuCategorySection({
  category,
  items,
  isAdmin,
  onAddItem,
  onEditItem,
  onRemoveItem,
  onToggleAvailability,
  onEditCategory,
  onDeleteCategory,
}: MenuCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="flex items-center gap-2 min-w-0 flex-1"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${category.name}`}
        >
          <span className="text-base font-semibold">{category.name}</span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => onAddItem(category.id)}
          >
            <Plus className="size-3 mr-1" />
            Add Item
          </Button>

          {isAdmin && (
            <>
              <button
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onEditCategory(category)}
                aria-label={`Edit category ${category.name}`}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => onDeleteCategory(category)}
                aria-label={`Delete category ${category.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Section body */}
      {isExpanded && (
        <div>
          {items.length === 0 ? (
            <div className="py-8 text-center space-y-3 border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">No items in this category.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddItem(category.id)}
              >
                <Plus className="size-3 mr-1" />
                Add Menu Item
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  onEdit={onEditItem}
                  onRemove={onRemoveItem}
                  onToggleAvailability={onToggleAvailability}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
