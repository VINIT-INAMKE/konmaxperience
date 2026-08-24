'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AddressForm } from '@/components/storefront/account/AddressForm';
import { accountKeys } from '@/components/storefront/account/account-queries';
import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { Button } from '@/components/ui/button';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import type { CustomerAddress, CustomerAddressPayload } from '@/lib/types/marketplace';
import { cn } from '@/lib/utils';

/**
 * Saved addresses — list, create, edit, delete and "make default".
 *
 * **Deleting the default is safe.** The server promotes the next-oldest address
 * when the default goes (`deleteAddress` in `customer-orders.service.ts`), so
 * this component does not try to pick a successor itself and simply refetches:
 * two writers choosing a default would race, and the server's choice is the one
 * checkout will read.
 *
 * The list is not reordered locally either. The API returns defaults first, then
 * newest — sorting again in the browser would disagree with the order the
 * checkout's address picker shows.
 */
export interface AddressBookProps {
  addresses: CustomerAddress[];
}

export function AddressBook({ addresses }: AddressBookProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: accountKeys.addresses() });

  const createAddress = useMutation({
    mutationFn: (payload: CustomerAddressPayload) =>
      apiClient.post<CustomerAddress>('/customer/addresses', payload),
    onSuccess: async () => {
      setCreating(false);
      await invalidate();
      toast.success('Address saved');
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, 'Could not save that address')),
  });

  const updateAddress = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CustomerAddressPayload }) =>
      apiClient.patch<CustomerAddress>(`/customer/addresses/${id}`, payload),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      toast.success('Address updated');
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, 'Could not update that address')),
  });

  const deleteAddress = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/customer/addresses/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success('Address removed');
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, 'Could not remove that address')),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch<CustomerAddress>(`/customer/addresses/${id}/default`, {}),
    onSuccess: async () => {
      await invalidate();
      toast.success('Default address changed');
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, 'Could not change the default')),
  });

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !creating ? (
        <StorefrontEmpty
          density="inline"
          icon={MapPin}
          title="No saved addresses"
          description="Save one now and checkout will be a click shorter."
        />
      ) : null}

      {addresses.length > 0 ? (
        <ul className="space-y-3">
          {addresses.map((address) =>
            editing === address.id ? (
              <li key={address.id}>
                <AddressForm
                  initial={address}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (payload) => {
                    await updateAddress.mutateAsync({ id: address.id, payload });
                  }}
                />
              </li>
            ) : (
              <li
                key={address.id}
                className={cn(
                  'flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-surface p-4',
                  address.is_default ? 'border-brand/40' : 'border-line',
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink-strong">
                      {address.label}
                    </span>
                    {address.is_default ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                        <Star className="size-3" aria-hidden="true" />
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink">{address.address}</p>
                  <p className="text-xs text-ink-muted">
                    {address.landmark ? `${address.landmark} · ` : ''}
                    {address.pincode}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {!address.is_default ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={setDefault.isPending}
                      onClick={() => setDefault.mutate(address.id)}
                    >
                      <Star className="size-3.5" aria-hidden="true" />
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${address.label} address`}
                    onClick={() => {
                      setCreating(false);
                      setEditing(address.id);
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${address.label} address`}
                    disabled={deleteAddress.isPending}
                    onClick={() => deleteAddress.mutate(address.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {creating ? (
        <AddressForm
          submitLabel="Save address"
          onCancel={() => setCreating(false)}
          onSubmit={async (payload) => {
            await createAddress.mutateAsync(payload);
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add an address
        </Button>
      )}
    </div>
  );
}
