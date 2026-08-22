'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem } from '@/lib/types/marketplace';

interface CartState {
  items: CartItem[];
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: 1 }],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.productId !== productId) };
          }
          return {
            items: state.items.map((i) =>
              i.productId === productId ? { ...i, quantity } : i,
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
      // v1 carts keyed every line by the old menu-item id; lines are now keyed
      // by `productId`, so drop an old cart instead of half-reading it.
      version: 2,
      migrate: () => ({ items: [], channel: null, deliveryAddressId: null }),
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
      // Belt and braces: a cart persisted by an older tab can still arrive in
      // the v1 shape. Drop anything that is not shaped like a CartItem.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<
          Pick<CartState, 'items' | 'channel' | 'deliveryAddressId'>
        >;
        return {
          ...current,
          ...stored,
          items: (stored.items ?? []).filter(
            (i) => typeof (i as Partial<CartItem>).productId === 'string',
          ),
        };
      },
    },
  ),
);
