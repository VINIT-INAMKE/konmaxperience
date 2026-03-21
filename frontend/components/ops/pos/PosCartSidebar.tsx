'use client';

import type { OrderChannel } from '@/lib/types/orders';

interface CartItem {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

interface ChannelFields {
  table_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_assigned_to: string;
}

interface PosCartSidebarProps {
  cartItems: CartItem[];
  channel: OrderChannel;
  onChannelChange: (channel: OrderChannel) => void;
  channelFields: ChannelFields;
  onChannelFieldChange: (field: string, value: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  subtotal: number;
  onUpdateQuantity: (menuItemId: string, delta: number) => void;
  onPlaceOrder: () => void;
  isPlacing: boolean;
  showBorderBeam: boolean;
}

// Stub component — fully implemented in Task 2
export function PosCartSidebar({
  cartItems,
  subtotal,
}: PosCartSidebarProps) {
  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-[20px] font-bold">Order Summary</h2>
      <p className="text-sm text-muted-foreground mt-2">
        {cartItems.length === 0
          ? 'No items yet'
          : `${cartItems.length} items — INR ${subtotal}`}
      </p>
    </div>
  );
}
