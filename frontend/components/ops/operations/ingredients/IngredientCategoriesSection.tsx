'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Check, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { apiClient } from '@/lib/api-client';
import type { IngredientCategoryItem } from '@/lib/types/ingredient';

export function IngredientCategoriesSection() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['ingredient-categories'],
    queryFn: () => apiClient.get<IngredientCategoryItem[]>('/ingredient-categories'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.post('/ingredient-categories', { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingredient-categories'] });
      setNewName('');
      setIsAdding(false);
      toast.success('Category added.');
    },
    onError: () => toast.error('A category with this name already exists.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ingredient-categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingredient-categories'] });
      toast.success('Category deleted.');
    },
    onError: () => toast.error('Failed to delete category.'),
  });

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          Ingredient Categories
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-3">
          {/* Category list */}
          <div className="divide-y">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{cat.name}</span>
                  {cat.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
                {!cat.is_default && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(cat.id)}
                        disabled={deleteMutation.isPending}
                        aria-label="Delete category"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete category</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>

          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No custom categories yet. Use the field below to add your first category.</p>
          )}

          {/* Add category inline */}
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Category name"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    createMutation.mutate(newName.trim());
                  }
                }}
              />
              <Button
                size="icon"
                className="size-8"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newName.trim())}
              >
                <Check className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="size-4 mr-1" /> Add Category
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
