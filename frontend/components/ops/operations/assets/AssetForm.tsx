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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AssetUploadZone } from './AssetUploadZone';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Asset, AssetType, AssetStatus } from '@/lib/types/asset';
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  ASSET_STATUS_LABELS,
} from '@/lib/types/asset';
import type { Brand } from '@/lib/types/brand';

interface AssetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset;
  onSuccess: (id: string) => void;
}

export function AssetForm({ open, onOpenChange, asset, onSuccess }: AssetFormProps) {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuthStore();
  const isAdmin = hasPermission('MANAGE_OPS');
  const isEdit = !!asset;

  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType | ''>('');
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState<AssetStatus>('draft');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
    enabled: open,
  });

  useEffect(() => {
    if (open && asset) {
      setName(asset.name);
      setAssetType(asset.asset_type);
      setBrandId(asset.linked_brand_id ?? '');
      setStatus(asset.status);
      setUploadedFile(null);
      setUploadedUrl(null);
    } else if (!open) {
      setName('');
      setAssetType('');
      setBrandId('');
      setStatus('draft');
      setUploadedFile(null);
      setUploadedUrl(null);
    }
  }, [open, asset]);

  const handleFileReady = (file: File, publicUrl: string) => {
    setUploadedFile(file);
    setUploadedUrl(publicUrl);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Determine available statuses for edit mode
  const getAvailableStatuses = (): AssetStatus[] => {
    if (isAdmin) return ['draft', 'in_review', 'approved', 'rejected'];
    if (!asset) return ['draft'];
    const isCreator = asset.created_by === user?.id;
    if (isCreator && asset.status === 'draft') return ['draft', 'in_review'];
    return [asset.status];
  };

  const getStatusToast = (newStatus: AssetStatus): string => {
    if (newStatus === 'in_review') return 'Asset submitted for review.';
    if (newStatus === 'approved') return 'Asset approved.';
    if (newStatus === 'rejected') return 'Asset rejected.';
    return 'Asset updated.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !assetType) {
      toast.error('Please fill in all required fields before saving.');
      return;
    }

    if (!isEdit && !uploadedUrl) {
      toast.error('Please fill in all required fields before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && asset) {
        const prevStatus = asset.status;
        await apiClient.patch<Asset>(`/assets/${asset.id}`, {
          name: name.trim(),
          asset_type: assetType,
          linked_brand_id: brandId || null,
          status,
        });
        const toastMsg = status !== prevStatus ? getStatusToast(status) : 'Asset updated.';
        toast.success(toastMsg);
        await queryClient.invalidateQueries({ queryKey: ['assets'] });
        handleClose();
        onSuccess(asset.id);
      } else {
        const created = await apiClient.post<Asset>('/assets', {
          name: name.trim(),
          asset_type: assetType,
          url: uploadedUrl,
          linked_brand_id: brandId || null,
          status: 'draft',
        });
        toast.success('Asset uploaded.');
        await queryClient.invalidateQueries({ queryKey: ['assets'] });
        handleClose();
        onSuccess(created.id);
      }
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = isEdit
    ? !isSubmitting && !!name.trim() && !!assetType
    : !isSubmitting && !!name.trim() && !!assetType && !!uploadedUrl;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Asset' : 'Upload Asset'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              placeholder="e.g. Nasi Goreng Recipe v2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Asset Type */}
          <div className="space-y-2">
            <Label>Asset Type</Label>
            <Select
              value={assetType}
              onValueChange={(v) => setAssetType(v as AssetType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ASSET_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label>Brand (optional)</Label>
            <Select
              value={brandId}
              onValueChange={(v) => setBrandId(v as string)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select brand">
                  {(value: string) => {
                    if (!value) return 'Select brand';
                    return brands.find(b => b.id === value)?.name ?? 'Select brand';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status — edit only */}
          {isEdit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as AssetStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableStatuses().map((s) => (
                    <SelectItem key={s} value={s}>
                      {ASSET_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Upload Zone — create only */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>File</Label>
              <AssetUploadZone
                onFileReady={handleFileReady}
                disabled={isSubmitting}
              />
              {uploadedFile && (
                <p className="text-xs text-good">
                  Ready: {uploadedFile.name}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-9 text-sm px-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </span>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Upload Asset'
              )}
            </Button>
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
