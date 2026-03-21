'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PulsatingButton } from '@/components/ui/pulsating-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { PosCartItemRow } from '@/components/ops/pos/PosCartItemRow';
import { PosChannelFields } from '@/components/ops/pos/PosChannelFields';
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

export function PosCartSidebar({
  cartItems,
  channel,
  onChannelChange,
  channelFields,
  onChannelFieldChange,
  notes,
  onNotesChange,
  subtotal,
  onUpdateQuantity,
  onPlaceOrder,
  isPlacing,
  showBorderBeam,
}: PosCartSidebarProps) {
  // Check required fields for Place Order
  const hasRequiredChannelFields = (() => {
    // Channel is always selected (default dine_in), no additional required fields for MVP
    return true;
  })();

  const canPlaceOrder =
    cartItems.length > 0 && hasRequiredChannelFields && !isPlacing;

  return (
    <div className="relative flex flex-col h-full">
      {/* BorderBeam flash on order success */}
      {showBorderBeam && <BorderBeam />}

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[20px] font-bold leading-tight">Order Summary</h2>
      </div>

      {/* Cart items list */}
      <ScrollArea className="flex-1 px-4">
        {cartItems.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <h3 className="text-base font-semibold">No items yet</h3>
            <p className="text-sm text-muted-foreground">
              Tap any menu item to add it to the order.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {cartItems.map((item) => (
              <PosCartItemRow
                key={item.menu_item_id}
                item={item}
                onUpdateQuantity={(delta) =>
                  onUpdateQuantity(item.menu_item_id, delta)
                }
              />
            ))}
          </AnimatePresence>
        )}
      </ScrollArea>

      {/* Bottom section: channel, totals, place order */}
      <div className="px-4 pb-4 space-y-3">
        {/* Channel fields */}
        <PosChannelFields
          channel={channel}
          onChannelChange={onChannelChange}
          fields={channelFields}
          onFieldChange={onChannelFieldChange}
        />

        <Separator />

        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-normal">Subtotal</span>
          <span className="font-mono text-[14px] font-bold tabular-nums">
            INR {subtotal}
          </span>
        </div>

        {/* Channel modifier note */}
        <p className="text-[12px] text-muted-foreground">
          Channel pricing applied at checkout
        </p>

        {/* Total estimate */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold">Total</span>
          <span className="font-mono text-[14px] font-bold tabular-nums">
            INR {subtotal}
          </span>
        </div>

        {/* Notes */}
        <Textarea
          placeholder="Any special requests? (optional)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-12"
        />

        {/* Place Order button */}
        {canPlaceOrder ? (
          <PulsatingButton
            className="w-full h-10 text-sm font-bold"
            onClick={onPlaceOrder}
            disabled={isPlacing}
          >
            {isPlacing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Placing...
              </span>
            ) : (
              'Place Order'
            )}
          </PulsatingButton>
        ) : (
          <Button className="w-full h-10" disabled>
            Place Order
          </Button>
        )}
      </div>
    </div>
  );
}
