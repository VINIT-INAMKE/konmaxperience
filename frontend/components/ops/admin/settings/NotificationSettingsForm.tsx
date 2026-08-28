'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Loader2, MoonStar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import {
  COOLDOWN_KEYS,
  COOLDOWN_LABELS,
  notificationsSettingSchema,
  toFormValues,
  toSettingValue,
  type NotificationsFormValues,
} from './notifications-setting';

interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

/**
 * RUN-01 — `SystemSetting['notifications']` as a form rather than as raw JSON.
 *
 * The screen it sits on renders `leaderboard_enabled` as a single switch, so
 * this follows that shape (a `Card` per concern) instead of introducing a
 * generic Json editor. It is a typed sub-form for one key, which is the
 * cheapest thing that stops an operator from breaking quiet hours with a
 * mistyped brace.
 *
 * `PATCH /settings/:key` replaces the whole Json value, so the form round-trips
 * `email_types` untouched — a key this form does not render is still a key it
 * must not delete.
 */
export function NotificationSettingsForm() {
  const queryClient = useQueryClient();
  const queryKey = ['settings', 'notifications'];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    /**
     * `GET /settings/:key` 404s until the row has actually been written, and
     * the reference seed writes it. A 404 here means "never edited", not
     * "broken", so it resolves to `null` and the form opens on the declared
     * defaults — `PATCH` upserts, so saving from that state creates the row.
     * Every other failure still surfaces as an error with a retry.
     */
    queryFn: async () => {
      try {
        return await apiClient.get<SettingRow>('/settings/notifications');
      } catch (error) {
        if (apiErrorStatus(error) === 404) return null;
        throw error;
      }
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsSettingSchema),
    defaultValues: toFormValues(undefined),
  });

  useEffect(() => {
    if (data) reset(toFormValues(data.value));
  }, [data, reset]);

  const whatsappEnabled = watch('whatsapp_enabled');

  const save = useMutation({
    mutationFn: (values: NotificationsFormValues) =>
      apiClient.patch('/settings/notifications', {
        value: toSettingValue(values, data?.value),
      }),
    onSuccess: async (_result, values) => {
      await queryClient.invalidateQueries({ queryKey });
      reset(values);
      toast.success('Notification settings saved.');
    },
    onError: (error) => {
      toast.error(
        apiErrorMessage(error, 'Could not save the notification settings.'),
      );
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not load notification settings</AlertTitle>
        <AlertDescription>
          In-app notifications are unaffected — only this form is unavailable.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))}>
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-1">
            <h2 className="text-base font-medium text-ink">Notifications</h2>
            <p className="text-sm text-ink-muted">
              How staff nudges leave the app. In-app notifications are always
              delivered and are not governed by anything on this card.
            </p>
          </div>

          {/* Master switch */}
          <div className="flex items-start justify-between gap-4 border-t border-[var(--line)] pt-6">
            <div className="space-y-1">
              <Label htmlFor="whatsapp-enabled" className="text-base font-medium">
                WhatsApp staff nudges
              </Label>
              <p className="max-w-md text-sm text-ink-muted">
                When off, nudges are written in-app only, whatever an individual
                has opted into.
              </p>
              <p className="max-w-md text-sm text-[var(--status-warning)]">
                WhatsApp templates must be approved in the Meta WhatsApp Manager
                before this is turned on.
              </p>
            </div>
            <Switch
              id="whatsapp-enabled"
              checked={whatsappEnabled}
              onCheckedChange={(checked) =>
                setValue('whatsapp_enabled', checked === true, {
                  shouldDirty: true,
                })
              }
              disabled={save.isPending}
              aria-label="Enable WhatsApp staff nudges"
            />
          </div>

          {/* Quiet hours */}
          <div className="space-y-3 border-t border-[var(--line)] pt-6">
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                <MoonStar className="size-4 text-ink-muted" aria-hidden="true" />
                Quiet hours
              </h3>
              <p className="max-w-md text-sm text-ink-muted">
                No WhatsApp message is sent inside this window. A window that
                crosses midnight is fine — 21:00 to 07:00 is the overnight one.
                The in-app notification is still written.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  className="w-36"
                  disabled={save.isPending}
                  aria-invalid={!!errors.quiet_hours?.start}
                  {...register('quiet_hours.start')}
                />
                {errors.quiet_hours?.start && (
                  <p className="text-xs text-destructive">
                    {errors.quiet_hours.start.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  className="w-36"
                  disabled={save.isPending}
                  aria-invalid={!!errors.quiet_hours?.end}
                  {...register('quiet_hours.end')}
                />
                {errors.quiet_hours?.end && (
                  <p className="text-xs text-destructive">
                    {errors.quiet_hours.end.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Per-type cooldowns */}
          <div className="space-y-3 border-t border-[var(--line)] pt-6">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-ink">Cooldowns</h3>
              <p className="max-w-md text-sm text-ink-muted">
                Hours before the same person is nudged about the same thing
                again. This is what stops one stuck approval from becoming a
                daily message.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COOLDOWN_KEYS.map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`cooldown-${key}`}>
                    {COOLDOWN_LABELS[key]}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`cooldown-${key}`}
                      type="number"
                      min={0}
                      max={168}
                      step={1}
                      inputMode="numeric"
                      className="w-24 tabular-nums"
                      disabled={save.isPending}
                      aria-invalid={!!errors.cooldown_hours?.[key]}
                      {...register(`cooldown_hours.${key}`, {
                        valueAsNumber: true,
                      })}
                    />
                    <span className="text-sm text-ink-muted">hours</span>
                  </div>
                  {errors.cooldown_hours?.[key] && (
                    <p className="text-xs text-destructive">
                      {errors.cooldown_hours[key]?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => reset(toFormValues(data?.value))}
              disabled={!isDirty || save.isPending}
            >
              Discard changes
            </Button>
            <Button type="submit" disabled={!isDirty || save.isPending}>
              {save.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </>
              ) : (
                'Save notification settings'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
