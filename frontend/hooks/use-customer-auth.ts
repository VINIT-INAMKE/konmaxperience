'use client';

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { useCartStore } from '@/lib/stores/cart-store';
import type { Customer, VerifyOtpResponse } from '@/lib/types/customer-auth';
import type { CartItem } from '@/lib/types/marketplace';

/** Response shape of `POST /customer/cart/sync` — the server-reconciled cart. */
interface CartSyncResponse {
  items: CartItem[];
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
}

export function useCustomerAuth() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    // Only attempt once per mount — avoid 401 spam when no cookie exists
    if (fetchedRef.current) return customer;
    fetchedRef.current = true;
    setIsLoading(true);
    try {
      const profile = await apiClient.get<Customer>('/customer-auth/profile');
      setCustomer(profile);
      return profile;
    } catch {
      setCustomer(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [customer]);

  const sendOtp = useCallback(async (phone: string) => {
    return apiClient.post<{ message: string }>('/customer-auth/send-otp', {
      phone,
    });
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const result = await apiClient.post<VerifyOtpResponse>(
      '/customer-auth/verify-otp',
      { phone, otp },
    );
    setCustomer(result.customer);
    fetchedRef.current = true; // mark as fetched so profile doesn't re-call

    // Sync local cart to Redis (fire-and-forget, per D-02)
    const { items, channel, deliveryAddressId } = useCartStore.getState();
    if (items.length > 0) {
      apiClient.post<CartSyncResponse>('/customer/cart/sync', { items, channel, deliveryAddressId })
        .then((syncResult) => {
          if (syncResult?.items) {
            useCartStore.getState().replaceCart(syncResult.items, syncResult.channel, syncResult.deliveryAddressId);
          }
        })
        .catch(() => { /* silent fail -- local cart still usable */ });
    }

    return result;
  }, []);

  const updateProfile = useCallback(
    async (data: { name?: string; email?: string }) => {
      const updated = await apiClient.patch<Customer>(
        '/customer-auth/profile',
        data,
      );
      setCustomer(updated);
      return updated;
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiClient.post('/customer-auth/logout', {});
    setCustomer(null);
    fetchedRef.current = false; // allow one fetch attempt on next visit
  }, []);

  return {
    customer,
    isLoading,
    fetchProfile,
    sendOtp,
    verifyOtp,
    updateProfile,
    logout,
  };
}
