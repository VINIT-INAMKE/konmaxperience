'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { apiClient } from '@/lib/api-client';
import type { Brand, BrandType, BrandStatus } from '@/lib/types/brand';
import {
  BRAND_TYPES,
  BRAND_STATUSES,
  BRAND_TYPE_LABELS,
  BRAND_STATUS_LABELS,
} from '@/lib/types/brand';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface BrandFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: Brand;
  isAdmin: boolean;
  onSuccess: (id: string) => void;
}

export function BrandForm({
  open,
  onOpenChange,
  brand,
  isAdmin,
  onSuccess,
}: BrandFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!brand;

  const [name, setName] = useState('');
  const [brandType, setBrandType] = useState<BrandType | ''>('');
  const [status, setStatus] = useState<BrandStatus | ''>('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (brand) {
      setName(brand.name);
      setBrandType(brand.brand_type);
      setStatus(brand.status);
      setOwnerUserId(brand.owner_user_id ?? '');
      setNotes(brand.notes ?? '');
    } else {
      setName('');
      setBrandType('');
      setStatus('');
      setOwnerUserId('');
      setNotes('');
    }
  }, [brand, open]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserOption[]>('/users'),
    enabled: open && isAdmin,
  });

  const handleClose = () => {
    setName('');
    setBrandType('');
    setStatus('');
    setOwnerUserId('');
    setNotes('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !brandType) return;

    setIsSubmitting(true);
    try {
      if (isEditing && brand) {
        const body: Record<string, unknown> = {};
        if (name.trim() !== brand.name) body.name = name.trim();
        if (brandType !== brand.brand_type) body.brand_type = brandType;
        if (status && status !== brand.status) body.status = status;
        if (ownerUserId !== (brand.owner_user_id ?? '')) {
          body.owner_user_id = ownerUserId || null;
        }
        if (notes.trim() !== (brand.notes ?? '')) body.notes = notes.trim() || null;

        const updated = await apiClient.patch<Brand>(`/brands/${brand.id}`, body);
        toast.success('Brand updated.');
        void queryClient.invalidateQueries({ queryKey: ['brands'] });
        handleClose();
        onSuccess(updated.id);
      } else {
        const created = await apiClient.post<Brand>('/brands', {
          name: name.trim(),
          brand_type: brandType,
          owner_user_id: ownerUserId || null,
          notes: notes.trim() || null,
        });
        toast.success('Brand created.');
        void queryClient.invalidateQueries({ queryKey: ['brands'] });
        handleClose();
        onSuccess(created.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Brand' : 'Add Brand'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              id="brand-name"
              placeholder="e.g. Konma Kitchen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Brand Type */}
          <div className="space-y-2">
            <Label>Brand Type</Label>
            <Select
              value={brandType}
              onValueChange={(v) => setBrandType(v as BrandType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {BRAND_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {BRAND_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status (edit only) */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as BrandStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {BRAND_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Owner (admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <Label>Owner (optional)</Label>
              <Select
                value={ownerUserId}
                onValueChange={(v) => setOwnerUserId(v as string)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign owner">
                    {(value: string) => {
                      if (!value) return 'Assign owner';
                      return users.find(u => u.id === value)?.name ?? 'Assign owner';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="brand-notes">Notes (optional)</Label>
            <Textarea
              id="brand-notes"
              placeholder="Additional context about this brand..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              style={{ minHeight: '80px' }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <ShimmerButton
              shimmerColor="#4ade80"
              type="submit"
              disabled={isSubmitting || !name.trim() || !brandType}
              className="h-9 text-sm px-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </span>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Add Brand'
              )}
            </ShimmerButton>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
