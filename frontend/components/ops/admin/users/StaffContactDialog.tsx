'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { ContactNotificationsFields } from './ContactNotificationsFields';
import {
  staffContactSchema,
  toContactPayload,
  type StaffContact,
  type StaffContactValues,
} from './staff-contact';

interface StaffContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ({ id: string; name: string } & StaffContact) | null;
}

/**
 * RUN-01 — the admin half of staff contactability: `PATCH /users/:id` with the
 * phone and the WhatsApp opt-in, behind `MANAGE_RBAC`.
 *
 * The other half is `PATCH /me/notification-prefs`, which needs no permission
 * at all: a teammate must be able to switch their own nudges off without
 * asking anyone. Both write the same two columns and both go through the same
 * "no number means no opt-in" rule, enforced again in `UsersService` so a
 * direct API call cannot get around this form.
 */
export function StaffContactDialog({
  open,
  onOpenChange,
  user,
}: StaffContactDialogProps) {
  const queryClient = useQueryClient();

  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StaffContactValues>({
    resolver: zodResolver(staffContactSchema),
    defaultValues: { phone: '', whatsapp_opt_in: false },
  });

  useEffect(() => {
    if (open && user) {
      reset({
        phone: user.phone ?? '',
        whatsapp_opt_in: user.whatsapp_opt_in ?? false,
      });
    }
  }, [open, user, reset]);

  const phone = watch('phone');
  const optIn = watch('whatsapp_opt_in');

  const save = useMutation({
    mutationFn: (values: StaffContactValues) =>
      apiClient.patch(`/users/${user?.id}`, toContactPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Contact details saved for ${user?.name ?? 'this user'}.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, 'Could not save the contact details.'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Contact &amp; notifications</DialogTitle>
          <DialogDescription>
            How {user?.name ?? 'this teammate'} is reached outside the app.
            In-app notifications are unaffected by these settings.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="space-y-4"
        >
          <ContactNotificationsFields
            idPrefix={`staff-contact-${user?.id ?? 'new'}`}
            phone={phone}
            onPhoneChange={(value) =>
              setValue('phone', value, { shouldValidate: true })
            }
            optIn={optIn}
            onOptInChange={(value) =>
              setValue('whatsapp_opt_in', value, { shouldValidate: true })
            }
            disabled={save.isPending}
            phoneError={errors.phone?.message ?? errors.whatsapp_opt_in?.message}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
