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
import type { Zone, ZoneType, ZoneStatus } from '@/lib/types/zone';
import {
  ZONE_TYPES,
  ZONE_STATUSES,
  ZONE_TYPE_LABELS,
  ZONE_STATUS_LABELS,
} from '@/lib/types/zone';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ZoneFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: Zone;
  isAdmin: boolean;
  onSuccess: (id: string) => void;
}

export function ZoneForm({
  open,
  onOpenChange,
  zone,
  isAdmin,
  onSuccess,
}: ZoneFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!zone;

  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType | ''>('');
  const [status, setStatus] = useState<ZoneStatus | ''>('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (zone) {
      setName(zone.name);
      setZoneType(zone.zone_type);
      setStatus(zone.status);
      setOwnerUserId(zone.owner_user_id ?? '');
      setNotes(zone.notes ?? '');
    } else {
      setName('');
      setZoneType('');
      setStatus('');
      setOwnerUserId('');
      setNotes('');
    }
  }, [zone, open]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserOption[]>('/users'),
    enabled: open && isAdmin,
  });

  const handleClose = () => {
    setName('');
    setZoneType('');
    setStatus('');
    setOwnerUserId('');
    setNotes('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !zoneType) return;

    setIsSubmitting(true);
    try {
      if (isEditing && zone) {
        const body: Record<string, unknown> = {};
        if (name.trim() !== zone.name) body.name = name.trim();
        if (zoneType !== zone.zone_type) body.zone_type = zoneType;
        if (status && status !== zone.status) body.status = status;
        if (ownerUserId !== (zone.owner_user_id ?? '')) {
          body.owner_user_id = ownerUserId || null;
        }
        if (notes.trim() !== (zone.notes ?? '')) body.notes = notes.trim() || null;

        const updated = await apiClient.patch<Zone>(`/zones/${zone.id}`, body);
        toast.success('Zone updated.');
        void queryClient.invalidateQueries({ queryKey: ['zones'] });
        handleClose();
        onSuccess(updated.id);
      } else {
        const created = await apiClient.post<Zone>('/zones', {
          name: name.trim(),
          zone_type: zoneType,
          owner_user_id: ownerUserId || null,
          notes: notes.trim() || null,
        });
        toast.success('Zone created.');
        void queryClient.invalidateQueries({ queryKey: ['zones'] });
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
          <SheetTitle>{isEditing ? 'Edit Zone' : 'Add Zone'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="zone-name">Name</Label>
            <Input
              id="zone-name"
              placeholder="e.g. Main Kitchen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Zone Type */}
          <div className="space-y-2">
            <Label>Zone Type</Label>
            <Select
              value={zoneType}
              onValueChange={(v) => setZoneType(v as ZoneType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ZONE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ZONE_TYPE_LABELS[type]}
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
                onValueChange={(v) => setStatus(v as ZoneStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {ZONE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ZONE_STATUS_LABELS[s]}
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
                  <SelectValue placeholder="Assign owner" />
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
            <Label htmlFor="zone-notes">Notes (optional)</Label>
            <Textarea
              id="zone-notes"
              placeholder="Additional context about this zone..."
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
              disabled={isSubmitting || !name.trim() || !zoneType}
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
                'Add Zone'
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
