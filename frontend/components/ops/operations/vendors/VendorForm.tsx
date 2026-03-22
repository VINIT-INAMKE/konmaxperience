'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
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
import type { Vendor } from '@/lib/types/vendor';
import { PAYMENT_TERMS_OPTIONS } from '@/lib/types/vendor';

interface VendorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor;
  onSuccess: () => void;
}

export function VendorForm({
  open,
  onOpenChange,
  vendor,
  onSuccess,
}: VendorFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!vendor;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<typeof PAYMENT_TERMS_OPTIONS[number] | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setPhone(vendor.phone ?? '');
      setEmail(vendor.email ?? '');
      setAddress(vendor.address ?? '');
      setPaymentTerms((vendor.payment_terms as typeof PAYMENT_TERMS_OPTIONS[number]) ?? '');
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setPaymentTerms('');
    }
  }, [vendor, open]);

  const handleClose = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setPaymentTerms('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        payment_terms: paymentTerms || null,
      };

      if (isEditing && vendor) {
        await apiClient.patch<Vendor>(`/vendors/${vendor.id}`, body);
        toast.success('Vendor updated.');
      } else {
        await apiClient.post<Vendor>('/vendors', body);
        toast.success('Vendor added.');
      }

      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      handleClose();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save vendor. Try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Vendor' : 'Add Vendor'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              placeholder="e.g. Fresh Farms Co."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="vendor-phone">Phone (optional)</Label>
            <Input
              id="vendor-phone"
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="vendor-email">Email (optional)</Label>
            <Input
              id="vendor-email"
              type="email"
              placeholder="e.g. vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="vendor-address">Address (optional)</Label>
            <Textarea
              id="vendor-address"
              placeholder="Vendor address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSubmitting}
              style={{ minHeight: '64px' }}
              rows={2}
            />
          </div>

          {/* Payment Terms */}
          <div className="space-y-2">
            <Label>Payment Terms (optional)</Label>
            <Select
              value={paymentTerms}
              onValueChange={(v) => setPaymentTerms(v as typeof PAYMENT_TERMS_OPTIONS[number])}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select payment terms" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS_OPTIONS.map((term) => (
                  <SelectItem key={term} value={term}>
                    {term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <ShimmerButton
              shimmerColor="#4ade80"
              type="submit"
              disabled={isSubmitting || !name.trim()}
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
                'Add Vendor'
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
