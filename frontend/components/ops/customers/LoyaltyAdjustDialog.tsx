'use client';

/**
 * `POST /customers/:id/loyalty-adjust { delta, notes }` (`LOYAL-01`, `MANAGE_OPS`).
 *
 * The client-side schema mirrors `AdjustLoyaltyDto` exactly — `delta` a whole
 * number, non-zero, within ±1 000 000; `notes` 3–500 characters and
 * **mandatory**. Every adjust writes a `LoyaltyTransaction(reason: adjust)` and
 * an `AuditEvent`, and an unexplained balance change is precisely what an audit
 * trail exists to prevent, so the reason is not optional here either.
 *
 * One extra rule the DTO cannot express: a negative delta that would take the
 * balance below zero is **blocked before the request**. `loyalty.service.ts`
 * throws a `400` for it and the DB `CHECK` would reject it regardless — but a
 * staff member deserves to be told the ceiling while they are typing rather than
 * after they press the button, so the form states the maximum it will accept.
 *
 * Not optimistic (P5b decision 24): the balance on screen only moves once the
 * server has answered, and the panel refetches from `GET /customers/:id`.
 */

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import type { AdjustLoyaltyPayload } from '@/lib/types/checkout';
import { formatPoints, formatPointsDelta } from '@/components/ops/customers/CustomerPanel';

/** `AdjustLoyaltyDto`'s own bounds — `@Min(-1_000_000) @Max(1_000_000)`. */
const DELTA_LIMIT = 1_000_000;
const NOTES_MIN = 3;
const NOTES_MAX = 500;

/** A signed whole number and nothing else — no decimal point, no thousands separator. */
const WHOLE_NUMBER = /^-?\d+$/;

/**
 * `delta` stays a **string** through the form and is converted once, on submit.
 *
 * An `<input type="number">` hands back a string, and a schema that coerced or
 * transformed it would make the form's input type differ from its output type —
 * which `useForm` then has to be told about through a third generic. Validating
 * the string and calling `Number()` in `onSubmit` keeps one type end to end and
 * lets an empty field say "enter a number" instead of "expected number,
 * received NaN".
 */
function adjustSchema(balance: number) {
  return z.object({
    delta: z
      .string()
      .trim()
      .min(1, 'Enter a number of points')
      .regex(WHOLE_NUMBER, 'Points are whole numbers — no decimals')
      .refine((value) => Number(value) !== 0, 'An adjustment of zero changes nothing')
      .refine(
        (value) => Math.abs(Number(value)) <= DELTA_LIMIT,
        `Adjustments are capped at ${formatPoints(DELTA_LIMIT)} points`,
      )
      .refine(
        (value) => balance + Number(value) >= 0,
        `That would take the balance below zero. The most you can remove is ${formatPoints(balance)}.`,
      ),
    notes: z
      .string()
      .trim()
      .min(NOTES_MIN, 'Say why — at least 3 characters')
      .max(NOTES_MAX, `Keep the reason under ${NOTES_MAX} characters`),
  });
}

type AdjustFormValues = { delta: string; notes: string };

interface LoyaltyAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  /** The balance the adjustment is applied to; the floor for a clawback. */
  currentBalance: number;
}

export function LoyaltyAdjustDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  currentBalance,
}: LoyaltyAdjustDialogProps) {
  const queryClient = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema(currentBalance)),
    defaultValues: { delta: '', notes: '' },
  });

  // A dialog that reopens holding the last attempt's numbers invites a
  // double-adjust, so the form is cleared each time it is closed.
  useEffect(() => {
    if (!open) reset({ delta: '', notes: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (payload: AdjustLoyaltyPayload) =>
      apiClient.post(`/customers/${customerId}/loyalty-adjust`, payload),
    onSuccess: async (_data, payload) => {
      toast.success(
        `${formatPointsDelta(payload.delta)} points for ${customerName}. The ledger has been updated.`,
      );
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customers', customerId] }),
        queryClient.invalidateQueries({ queryKey: ['customers', 'list'] }),
      ]);
    },
  });

  // `useWatch`, not `watch()`: the subscription form is memoizable, so the
  // React Compiler does not have to skip this component wholesale.
  const rawDelta = (useWatch({ control, name: 'delta' }) ?? '').trim();
  const notes = useWatch({ control, name: 'notes' }) ?? '';
  const delta = WHOLE_NUMBER.test(rawDelta) ? Number(rawDelta) : null;
  const preview =
    delta !== null && delta !== 0 && currentBalance + delta >= 0
      ? currentBalance + delta
      : null;

  function onSubmit(values: AdjustFormValues) {
    mutation.mutate({ delta: Number(values.delta.trim()), notes: values.notes.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Adjust loyalty points</DialogTitle>
          <DialogDescription>
            {customerName} has {formatPoints(currentBalance)} points. A positive
            number credits, a negative number claws back.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {apiErrorMessage(
                  mutation.error,
                  'The adjustment did not save. Nothing has been changed.',
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="loyalty-delta">Points</Label>
            <Input
              id="loyalty-delta"
              type="number"
              step={1}
              inputMode="numeric"
              placeholder="e.g. 250 or -50"
              disabled={mutation.isPending}
              aria-invalid={!!errors.delta}
              aria-describedby={errors.delta ? 'loyalty-delta-error' : 'loyalty-delta-hint'}
              {...register('delta')}
            />
            {errors.delta ? (
              <p id="loyalty-delta-error" className="text-xs text-destructive">
                {errors.delta.message}
              </p>
            ) : (
              <p id="loyalty-delta-hint" className="text-xs text-muted-foreground">
                {preview === null || delta === null
                  ? `You can remove at most ${formatPoints(currentBalance)} points.`
                  : `New balance: ${formatPoints(preview)} points (${formatPointsDelta(delta)}).`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="loyalty-notes">Reason</Label>
            <Textarea
              id="loyalty-notes"
              rows={3}
              maxLength={NOTES_MAX}
              placeholder="Goodwill credit for the delayed shipment on order #1042"
              disabled={mutation.isPending}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? 'loyalty-notes-error' : 'loyalty-notes-hint'}
              {...register('notes')}
            />
            {errors.notes ? (
              <p id="loyalty-notes-error" className="text-xs text-destructive">
                {errors.notes.message}
              </p>
            ) : (
              <p id="loyalty-notes-hint" className="text-xs text-muted-foreground">
                Required — it is written to the ledger and the audit log.{' '}
                {notes.length}/{NOTES_MAX}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving…
                </>
              ) : (
                'Apply adjustment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
