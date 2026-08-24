'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import type { Coupon } from '@/lib/types/promotions';
import {
  CouponForm,
  toCreatePayload,
  toUpdatePayload,
  type CouponFormValues,
} from './CouponForm';

interface CouponSheetProps {
  /** Absent = create a new coupon. */
  coupon?: Coupon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The create/edit surface (`IA-05`: a Sheet, not a page).
 *
 * The mutation lives here rather than in {@link CouponForm} so the form stays a
 * pure "values in, values out" component — and so the one error the client
 * genuinely cannot predict, a `409` on the unique `code`, is rendered from the
 * server's own message ("A coupon with the code WELCOME10 already exists")
 * rather than guessed at.
 */
export function CouponSheet({ coupon, open, onOpenChange }: CouponSheetProps) {
  const queryClient = useQueryClient();
  const isEditing = !!coupon;

  const save = useMutation({
    mutationFn: async (values: CouponFormValues) =>
      isEditing && coupon
        ? apiClient.patch<Coupon>(
            `/promotions/coupons/${coupon.id}`,
            toUpdatePayload(values),
          )
        : apiClient.post<Coupon>('/promotions/coupons', toCreatePayload(values)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['promotions', 'coupons'] });
      toast.success(
        isEditing ? `${saved.code} updated.` : `${saved.code} created.`,
        {
          description:
            saved.status === 'active'
              ? 'It is offered at checkout inside its window.'
              : 'It stays a draft until you set it to Active.',
        },
      );
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, 'The coupon could not be saved.'));
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[560px]"
      >
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit coupon' : 'New coupon'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Changes apply to every checkout from the moment you save.'
              : 'A new coupon starts as a draft — nothing is offered to customers until you set it to Active.'}
          </SheetDescription>
        </SheetHeader>

        <CouponForm
          coupon={coupon}
          open={open}
          isSubmitting={save.isPending}
          onSubmit={(values) => save.mutate(values)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
