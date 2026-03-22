'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VendorCard } from '@/components/ops/operations/vendors/VendorCard';
import { VendorForm } from '@/components/ops/operations/vendors/VendorForm';
import { VendorDetail } from '@/components/ops/operations/vendors/VendorDetail';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Vendor } from '@/lib/types/vendor';

export default function VendorsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: vendors,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => apiClient.get<Vendor[]>('/vendors'),
  });

  const handleAddClick = () => {
    setEditingVendor(null);
    setFormOpen(true);
  };

  const handleEditClick = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingVendor(null);
  };

  const handleViewClick = (vendor: Vendor) => {
    setDetailVendor(vendor);
    setDetailOpen(true);
  };

  const handleDeactivate = async (vendor: Vendor) => {
    try {
      await apiClient.patch<Vendor>(`/vendors/${vendor.id}`, { status: 'inactive' });
      toast.success(`${vendor.name} deactivated.`);
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingVendor) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/vendors/${deletingVendor.id}`);
      toast.success('Vendor deleted.');
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setDeletingVendor(null);
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
          <h1 className="text-2xl font-bold">Vendors</h1>
          <Button onClick={handleAddClick}>Add Vendor</Button>
        </div>

        {/* Table */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading vendors...</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Something went wrong. Refresh the page or try again in a moment.
          </div>
        )}

        {!isLoading && !isError && (!vendors || vendors.length === 0) && (
          <div className="py-16 text-center space-y-3">
            <h2 className="text-base font-semibold">No vendors yet</h2>
            <p className="text-sm text-muted-foreground">
              Add your ingredient suppliers. Each vendor can have a price history per ingredient.
            </p>
            <Button onClick={handleAddClick}>Add Vendor</Button>
          </div>
        )}

        {!isLoading && !isError && vendors && vendors.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Payment Terms
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    isAdmin={isAdmin}
                    onView={handleViewClick}
                    onEdit={handleEditClick}
                    onDeactivate={(v) => void handleDeactivate(v)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Vendor create/edit Sheet */}
        <VendorForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          vendor={editingVendor ?? undefined}
          onSuccess={() => void queryClient.invalidateQueries({ queryKey: ['vendors'] })}
        />

        {/* Vendor detail Sheet */}
        <VendorDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          vendor={detailVendor}
        />

        {/* Delete confirmation Dialog */}
        <Dialog
          open={!!deletingVendor}
          onOpenChange={(open) => { if (!open) setDeletingVendor(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deletingVendor?.name}?</DialogTitle>
              <DialogDescription>
                This vendor and all their price history will be removed. Recipes using these prices will lose their cost data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingVendor(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Vendor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
