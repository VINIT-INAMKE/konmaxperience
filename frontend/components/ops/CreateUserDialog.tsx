'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { ROLE_DISPLAY_NAMES } from '@/lib/types/roles';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  roleId: z.string().min(1, 'Select a role'),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
}: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<Role[]>('/roles'),
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({
    defaultValues: { name: '', email: '', roleId: '' },
  });

  async function onSubmit(data: CreateUserForm) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.post('/users', {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
      });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setToast(`Invitation sent to ${data.name}`);
      reset();
      onOpenChange(false);
      // Show toast briefly
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDiscard() {
    reset();
    setSubmitError(null);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              They will receive an email to set their password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Jane Smith"
                disabled={isSubmitting}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                {...register('name', {
                  required: 'Name is required',
                  minLength: {
                    value: 2,
                    message: 'Name must be at least 2 characters',
                  },
                })}
              />
              {errors.name && (
                <p id="name-error" className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email', {
                  required: 'Email is required',
                })}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                onValueChange={(value) => setValue('roleId', value as string)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full" aria-invalid={!!errors.roleId}>
                  <SelectValue placeholder="Select a role">
                    {(value: string) => {
                      if (!value) return 'Select a role';
                      const role = roles?.find(r => r.id === value);
                      if (!role) return 'Select a role';
                      return ROLE_DISPLAY_NAMES[role.code as keyof typeof ROLE_DISPLAY_NAMES] || role.name;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {ROLE_DISPLAY_NAMES[role.code as keyof typeof ROLE_DISPLAY_NAMES] ||
                        role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p className="text-xs text-destructive">
                  {errors.roleId.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={handleDiscard}
                disabled={isSubmitting}
              >
                Discard
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    Adding...
                  </>
                ) : (
                  'Add member'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in-0 motion-reduce:animate-none rounded-lg border bg-card px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
