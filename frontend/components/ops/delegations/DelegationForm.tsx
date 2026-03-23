'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
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

interface DelegationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function DelegationForm({ open, onOpenChange, onCreated }: DelegationFormProps) {
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserOption[]>('/users'),
    enabled: open,
  });

  const toUserOptions = users.filter((u) => u.id !== fromUserId);

  const dateError = endDate && startDate && endDate < startDate
    ? 'End date must be after start date.'
    : null;

  const isValid = fromUserId && toUserId && startDate && endDate && !dateError;

  const handleClose = () => {
    setFromUserId('');
    setToUserId('');
    setStartDate('');
    setEndDate('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await apiClient.post('/delegations', {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        start_date: startDate,
        end_date: endDate,
      });
      const fromName = users.find((u) => u.id === fromUserId)?.name ?? 'user';
      const toName = users.find((u) => u.id === toUserId)?.name ?? 'user';
      toast.success(
        `Delegation created. ${toName} can approve on behalf of ${fromName} until ${endDate}.`,
      );
      onCreated();
      handleClose();
    } catch {
      toast.error("Couldn't create that delegation \u2014 check for date conflicts and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Create Delegation</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* From User */}
          <div className="space-y-2">
            <Label htmlFor="from-user">Delegating From (Absent User)</Label>
            <Select
              value={fromUserId}
              onValueChange={(v) => {
                setFromUserId(v as string);
                if (toUserId === v) setToUserId('');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger id="from-user" className="w-full">
                <SelectValue placeholder="Select user">
                  {(value: string) => {
                    if (!value) return 'Select user';
                    return users.find(u => u.id === value)?.name ?? 'Select user';
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

          {/* To User */}
          <div className="space-y-2">
            <Label htmlFor="to-user">Delegate To</Label>
            <Select
              value={toUserId}
              onValueChange={(v) => setToUserId(v as string)}
              disabled={isSubmitting || !fromUserId}
            >
              <SelectTrigger id="to-user" className="w-full">
                <SelectValue placeholder={fromUserId ? 'Select user' : 'Select delegating-from user first'}>
                  {(value: string) => {
                    if (!value) return fromUserId ? 'Select user' : 'Select delegating-from user first';
                    return users.find(u => u.id === value)?.name ?? 'Select user';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {toUserOptions.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="start-date">Start</Label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              disabled={isSubmitting}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minWidth: '140px' }}
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="end-date">End</Label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              disabled={isSubmitting}
              aria-describedby={dateError ? 'end-date-error' : undefined}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minWidth: '140px' }}
            />
            {dateError && (
              <p id="end-date-error" className="text-sm text-destructive">
                End date must be after start date.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <ShimmerButton
              type="submit"
              disabled={isSubmitting || !isValid}
              className="h-9 text-sm px-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Setting up delegation...
                </span>
              ) : (
                'Create Delegation'
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
