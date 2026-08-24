'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { accountKeys } from '@/components/storefront/account/account-queries';
import { Button } from '@/components/ui/button';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { useCartStore } from '@/lib/stores/cart-store';

/**
 * Sign out (`ACCT-02`).
 *
 * Three things have to happen and none of them is optional:
 *
 * 1. `POST /customer-auth/logout` revokes the token's `jti` server-side and
 *    clears the cookie. Until P5b Task 2 this route was one of the six the
 *    global `PermissionsGuard` rejected, so signing out did not revoke anything.
 * 2. The `['account', …]` query cache is **removed**, not invalidated. An
 *    invalidated cache still holds the previous customer's orders and addresses
 *    until something refetches; on a shared device that is a disclosure.
 * 3. The local cart is cleared. It is a `localStorage` cart keyed to nobody, so
 *    leaving it behind hands the next person a basket they did not fill.
 *
 * The session is dropped even if the request fails — see `logoutCustomer`.
 */
export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useCustomerAuth();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } catch {
      toast.error('Signed out on this device', {
        description: 'We could not reach the server, so do sign out again elsewhere.',
      });
    } finally {
      queryClient.removeQueries({ queryKey: accountKeys.all });
      useCartStore.getState().clearCart();
      setBusy(false);
      router.replace('/');
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      disabled={busy}
      onClick={() => void handleLogout()}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      Sign out
    </Button>
  );
}
