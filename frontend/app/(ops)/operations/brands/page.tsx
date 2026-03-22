'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BrandCard } from '@/components/ops/operations/brands/BrandCard';
import { BrandForm } from '@/components/ops/operations/brands/BrandForm';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Brand, BrandStatus } from '@/lib/types/brand';

type StatusFilter = 'all' | BrandStatus;

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;
  const currentUserId = user?.id ?? '';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [newBrandId, setNewBrandId] = useState<string | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: brands,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
  });

  const filteredBrands = useMemo(() => {
    if (!brands) return [];
    let result = brands;
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(query));
    }
    return result;
  }, [brands, statusFilter, searchQuery]);

  // Clear newBrandId after 3.5 seconds
  useEffect(() => {
    if (newBrandId) {
      const timer = setTimeout(() => setNewBrandId(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [newBrandId]);

  const handleBrandSuccess = (id: string) => {
    setNewBrandId(id);
    void queryClient.invalidateQueries({ queryKey: ['brands'] });
  };

  const handleEditClick = (brand: Brand) => {
    setEditingBrand(brand);
    setFormOpen(true);
  };

  const handleAddClick = () => {
    setEditingBrand(null);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingBrand(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBrand) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/brands/${deletingBrand.id}`);
      toast.success('Brand deleted.');
      void queryClient.invalidateQueries({ queryKey: ['brands'] });
      setDeletingBrand(null);
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Brands</h1>
          {isAdmin && (
            <Button onClick={handleAddClick}>Add Brand</Button>
          )}
        </div>

        {/* Filter bar: tabs + search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="idea">Idea</TabsTrigger>
              <TabsTrigger value="planning">Planning</TabsTrigger>
              <TabsTrigger value="development">Development</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Brands grid */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading brands...</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Something went wrong. Refresh the page or try again in a moment.
          </div>
        )}
        {!isLoading && !isError && filteredBrands.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <h2 className="text-base font-semibold">No brands yet</h2>
            <p className="text-sm text-muted-foreground">
              Add your food, art, or lifestyle brands to get started.
            </p>
          </div>
        )}
        {!isLoading && !isError && filteredBrands.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBrands.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                isNew={brand.id === newBrandId}
                onEdit={handleEditClick}
                onDelete={(b) => setDeletingBrand(b)}
              />
            ))}
          </div>
        )}

        {/* Brand create/edit Sheet */}
        <BrandForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          brand={editingBrand ?? undefined}
          isAdmin={isAdmin}
          onSuccess={handleBrandSuccess}
        />

        {/* Delete confirmation Dialog */}
        <Dialog
          open={!!deletingBrand}
          onOpenChange={(open) => { if (!open) setDeletingBrand(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Brand</DialogTitle>
              <DialogDescription>
                This will permanently remove this brand. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingBrand(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Brand'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
