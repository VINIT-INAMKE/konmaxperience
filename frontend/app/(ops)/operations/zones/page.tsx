'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, MapPin } from 'lucide-react';
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
import { ZoneCard } from '@/components/ops/operations/zones/ZoneCard';
import { ZoneForm } from '@/components/ops/operations/zones/ZoneForm';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Zone, ZoneStatus } from '@/lib/types/zone';

type StatusFilter = 'all' | ZoneStatus;

export default function ZonesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;
  const currentUserId = user?.id ?? '';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [newZoneId, setNewZoneId] = useState<string | null>(null);
  const [deletingZone, setDeletingZone] = useState<Zone | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: zones,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const filteredZones = useMemo(() => {
    if (!zones) return [];
    let result = zones;
    if (statusFilter !== 'all') {
      result = result.filter((z) => z.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((z) => z.name.toLowerCase().includes(query));
    }
    return result;
  }, [zones, statusFilter, searchQuery]);

  // Clear newZoneId after 3.5 seconds
  useEffect(() => {
    if (newZoneId) {
      const timer = setTimeout(() => setNewZoneId(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [newZoneId]);

  const handleZoneSuccess = (id: string) => {
    setNewZoneId(id);
    void queryClient.invalidateQueries({ queryKey: ['zones'] });
  };

  const handleEditClick = (zone: Zone) => {
    setEditingZone(zone);
    setFormOpen(true);
  };

  const handleAddClick = () => {
    setEditingZone(null);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingZone(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingZone) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/zones/${deletingZone.id}`);
      toast.success('Zone deleted.');
      void queryClient.invalidateQueries({ queryKey: ['zones'] });
      setDeletingZone(null);
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
          <h1 className="text-2xl font-bold">Zones</h1>
          {isAdmin && (
            <Button onClick={handleAddClick}>Add Zone</Button>
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
              <TabsTrigger value="planned">Planned</TabsTrigger>
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search zones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Zones grid */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading zones...</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Something went wrong. Refresh the page or try again in a moment.
          </div>
        )}
        {!isLoading && !isError && filteredZones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <MapPin className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No Zones Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Add the physical spaces your villa operates in.
            </p>
          </div>
        )}
        {!isLoading && !isError && filteredZones.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredZones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                isNew={zone.id === newZoneId}
                onEdit={handleEditClick}
                onDelete={(z) => setDeletingZone(z)}
              />
            ))}
          </div>
        )}

        {/* Zone create/edit Sheet */}
        <ZoneForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          zone={editingZone ?? undefined}
          isAdmin={isAdmin}
          onSuccess={handleZoneSuccess}
        />

        {/* Delete confirmation Dialog */}
        <Dialog
          open={!!deletingZone}
          onOpenChange={(open) => { if (!open) setDeletingZone(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Zone</DialogTitle>
              <DialogDescription>
                This will permanently remove this zone. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingZone(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Zone'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
