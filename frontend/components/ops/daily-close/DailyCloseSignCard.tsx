'use client';

/**
 * RUN-02 sign-off — the one irreversible action on this screen.
 *
 * A signature does two things at once: it flips the row to `signed`, and it
 * **freezes the metrics for good**. `computeAndUpsert` returns a signed row
 * untouched, so a late refund, a corrected waste entry or a re-run of the cron
 * can never move a figure somebody has already put their name to. That is the
 * entire reason a close is a persisted artefact rather than a live query — and
 * it is why the confirm dialog says so in plain words instead of asking
 * "Are you sure?".
 *
 * Two gates guard the button, and only one of them matters. The client checks
 * the viewer's role against the seeded `daily_close.signer_role_codes` so it can
 * avoid offering an action that will fail; the **server re-reads the live
 * setting** and answers `403` regardless. A drifted client copy therefore costs
 * a confusing button, never an unauthorised signature.
 *
 * The two server failures are handled as different events, because they mean
 * different things to the person standing at the screen:
 *
 * - **`409`** — somebody else signed this day between the render and the click.
 *   Nothing is wrong; the day is closed. Refetch and let the receipt appear.
 * - **`403`** — this role is not a signatory. The server's message names who is,
 *   so it is shown verbatim rather than replaced with a guess.
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, PenLine, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  apiClient,
  apiErrorMessage,
  apiErrorStatus,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/format/date';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserProfile } from '@/lib/types/users';
import {
  DAILY_CLOSE_NOTES_MAX,
  DAILY_CLOSE_SIGNER_ROLE_CODES,
  type DailyCloseView,
  type SignDailyClosePayload,
} from '@/lib/types/daily-close';

const signSchema = z.object({
  notes: z
    .string()
    .max(
      DAILY_CLOSE_NOTES_MAX,
      `Keep the note under ${DAILY_CLOSE_NOTES_MAX} characters — it is frozen with the numbers.`,
    ),
});

type SignFormValues = z.infer<typeof signSchema>;

/**
 * Resolves a signatory's `User.id` to a name.
 *
 * `GET /daily-close/:date` returns the raw id, and `GET /users` needs
 * `VIEW_ALL` — which a `MANAGE_OPS` holder does not necessarily have. So: the
 * viewer's own name comes free from the auth store, the directory is consulted
 * only when the viewer may read it, and a failure degrades to a neutral phrase
 * rather than printing a UUID at somebody.
 */
export function useSignerName(userId: string | null): string | null {
  const viewer = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const isSelf = Boolean(userId) && viewer?.id === userId;
  const mayReadDirectory = permissions.includes('VIEW_ALL');

  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserProfile[]>('/users'),
    enabled: Boolean(userId) && !isSelf && mayReadDirectory,
    retry: false,
    staleTime: 300_000,
  });

  if (!userId) return null;
  if (isSelf) return viewer?.name ?? null;
  return data?.find((u) => u.id === userId)?.name ?? null;
}

export interface DailyCloseSignCardProps {
  close: DailyCloseView;
  /** Called with the signed row so the parent can seed its cache without a round trip. */
  onSigned: (signed: DailyCloseView) => void;
  /** Called when the server says the day moved underneath us (409). */
  onConflict: () => void;
}

export function DailyCloseSignCard({
  close,
  onSigned,
  onConflict,
}: DailyCloseSignCardProps) {
  const roleCode = useAuthStore((s) => s.user?.roleCode);
  const signerName = useSignerName(close.signed_by);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    watch,
    formState: { errors },
  } = useForm<SignFormValues>({
    resolver: zodResolver(signSchema),
    defaultValues: { notes: '' },
  });

  // A new business day is a new note. Without this, a remark typed for the 3rd
  // would still be in the box when the picker moves to the 4th.
  useEffect(() => {
    reset({ notes: '' });
    setConfirmOpen(false);
  }, [close.business_date, reset]);

  const signMutation = useMutation({
    mutationFn: (payload: SignDailyClosePayload) =>
      apiClient.post<DailyCloseView>(
        `/daily-close/${close.business_date}/sign`,
        payload,
      ),
    onSuccess: (signed) => {
      setConfirmOpen(false);
      toast.success(
        `${close.business_date} is signed. The numbers are now frozen.`,
      );
      onSigned(signed);
    },
    onError: (error) => {
      setConfirmOpen(false);
      const status = apiErrorStatus(error);
      if (status === 409) {
        toast.info('Someone else signed this day — refreshing.');
        onConflict();
        return;
      }
      if (status === 403) {
        // The server names the roles that may sign; that is more useful than
        // anything this component could invent.
        toast.error(
          apiErrorMessage(error, 'Your role cannot sign the daily close.'),
        );
        return;
      }
      toast.error(
        apiErrorMessage(error, 'Could not sign this day. Try again in a moment.'),
      );
    },
  });

  // ── Already signed: a receipt, not a form. ───────────────────────────────
  if (close.status === 'signed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            Signed off
          </CardTitle>
          <CardDescription>
            These numbers are frozen. A recompute of this day returns the row
            unchanged — that is what the signature buys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-0.5">
              <dt className="text-xs font-medium text-muted-foreground">
                Signed by
              </dt>
              <dd className="text-sm font-medium">
                {signerName ?? 'A signatory'}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-xs font-medium text-muted-foreground">
                Signed at
              </dt>
              <dd className="text-sm font-medium tabular-nums">
                {formatDateTime(close.signed_at)}
              </dd>
            </div>
          </dl>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Signatory&apos;s note
            </p>
            {close.notes ? (
              <p className="text-sm whitespace-pre-wrap">{close.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No note was left with this signature.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Open, but this viewer is not a signatory. ────────────────────────────
  if (!roleCode || !DAILY_CLOSE_SIGNER_ROLE_CODES.includes(roleCode)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-muted-foreground" />
            Not yet signed
          </CardTitle>
          <CardDescription>
            This day is still open. Sign-off is reserved for the Frontend Lead
            and the Founder/Admin — running operations and being accountable for
            the day are different claims.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const notes = watch('notes');
  const remaining = DAILY_CLOSE_NOTES_MAX - (notes?.length ?? 0);

  // ── Open, and this viewer may sign it. ───────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="size-4 text-muted-foreground" />
            Sign off on {close.business_date}
          </CardTitle>
          <CardDescription>
            Signing freezes every figure above. Anything that lands after this —
            a late refund, a corrected waste entry — will not change what you
            signed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(() => setConfirmOpen(true))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="daily-close-notes">
                Note{' '}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="daily-close-notes"
                rows={3}
                placeholder="Power cut 19:00–20:30, two orders comped…"
                disabled={signMutation.isPending}
                aria-invalid={!!errors.notes}
                {...register('notes')}
              />
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Frozen with the numbers, so write it for whoever reads this day
                  a year from now.
                </p>
                <span
                  className={
                    remaining < 0
                      ? 'shrink-0 text-xs tabular-nums text-destructive'
                      : 'shrink-0 text-xs tabular-nums text-muted-foreground'
                  }
                >
                  {remaining}
                </span>
              </div>
              {errors.notes ? (
                <p className="text-xs text-destructive">
                  {errors.notes.message}
                </p>
              ) : null}
            </div>

            <Button type="submit" disabled={signMutation.isPending}>
              <PenLine />
              Sign off
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign off on {close.business_date}?</DialogTitle>
            <DialogDescription>
              A signed close is frozen and cannot be recomputed. The figures on
              this screen become the permanent record of the day, and there is no
              way to unsign it.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={signMutation.isPending}
            >
              Not yet
            </Button>
            <Button
              type="button"
              disabled={signMutation.isPending}
              onClick={() => {
                const value = getValues('notes').trim();
                signMutation.mutate(value ? { notes: value } : {});
              }}
            >
              <Lock />
              {signMutation.isPending ? 'Signing…' : 'Sign and freeze'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
