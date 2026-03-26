'use client';

import { useCallback } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { apiClient } from '@/lib/api-client';
import type { CartData, CustomerOrder } from '@/lib/types/marketplace';

export function useCart() {
  const store = useCartStore();
  const { customer } = useCustomerAuth();

  // Sync local cart to Redis on login
  const syncToServer = useCallback(async () => {
    if (!customer?.id) return;
    const { items, channel, deliveryAddressId } = useCartStore.getState();
    if (items.length === 0) return;
    try {
      const result = await apiClient.post<CartData>('/customer/cart/sync', {
        items,
        channel,
        deliveryAddressId,
      });
      // Replace local cart with server merge result
      if (result?.items) {
        useCartStore.getState().replaceCart(result.items, result.channel, result.deliveryAddressId);
      }
    } catch {
      /* silent fail -- local cart is still usable */
    }
  }, [customer?.id]);

  // Checkout -- calls POST /customer/orders
  const checkout = useCallback(async () => {
    const response = await apiClient.post<{ razorpay_order_id: string }>('/customer/orders');
    return response;
  }, []);

  // Confirm -- calls POST /customer/orders/confirm
  const confirmOrder = useCallback(async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const result = await apiClient.post<CustomerOrder>('/customer/orders/confirm', payload);
    useCartStore.getState().clearCart();
    return result;
  }, []);

  return {
    ...store,
    syncToServer,
    checkout,
    confirmOrder,
    isLoggedIn: !!customer,
  };
}
