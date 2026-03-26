'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem } from '@/lib/types/marketplace';

interface CartState {
  items: CartItem[];
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  setChannel: (channel: 'takeaway' | 'delivery') => void;
  setDeliveryAddress: (addressId: string | null) => void;
  clearCart: () => void;
  replaceCart: (items: CartItem[], channel?: 'takeaway' | 'delivery' | null, addressId?: string | null) => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      channel: null,
      deliveryAddressId: null,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.menuItemId === item.menuItemId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: 1 }],
          };
        }),

      removeItem: (menuItemId) =>
        set((state) => ({
          items: state.items.filter((i) => i.menuItemId !== menuItemId),
        })),

      updateQuantity: (menuItemId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.menuItemId !== menuItemId) };
          }
          return {
            items: state.items.map((i) =>
              i.menuItemId === menuItemId ? { ...i, quantity } : i,
            ),
          };
        }),

      setChannel: (channel) => set({ channel }),

      setDeliveryAddress: (addressId) => set({ deliveryAddressId: addressId }),

      clearCart: () => set({ items: [], channel: null, deliveryAddressId: null }),

      replaceCart: (items, channel, addressId) =>
        set({
          items,
          channel: channel ?? null,
          deliveryAddressId: addressId ?? null,
        }),

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((sum, i) => sum + i.quantity, 0);
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({
        items: state.items,
        channel: state.channel,
        deliveryAddressId: state.deliveryAddressId,
      }),
    },
  ),
);
