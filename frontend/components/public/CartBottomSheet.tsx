'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Minus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChannelToggle } from '@/components/public/ChannelToggle';
import { AddressSelector } from '@/components/public/AddressSelector';
import { CustomerOtpForm } from '@/components/public/CustomerOtpForm';
import { useCart } from '@/hooks/use-cart';
import { useCartStore } from '@/lib/stores/cart-store';
import { useRazorpay } from '@/hooks/use-razorpay';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { apiClient } from '@/lib/api-client';
import type { CustomerAddress } from '@/lib/types/marketplace';
import type { Customer } from '@/lib/types/customer-auth';

interface CartBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartBottomSheet({ open, onOpenChange }: CartBottomSheetProps) {
  const router = useRouter();
  const { customer } = useCustomerAuth();
  const { items, channel, deliveryAddressId, setChannel, setDeliveryAddress, checkout, confirmOrder } = useCart();

  const [showLogin, setShowLogin] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [serviceabilityError, setServiceabilityError] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const total = subtotal + (channel === 'delivery' ? deliveryCharge : 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  // Auto-close when cart is empty
  useEffect(() => {
    if (open && totalItems === 0) {
      onOpenChange(false);
    }
  }, [totalItems, open, onOpenChange]);

  // Fetch addresses when logged in
  useEffect(() => {
    if (!customer?.id || !open) return;
    apiClient
      .get<CustomerAddress[]>('/customer/addresses')
      .then((data) => {
        setAddresses(data);
        // Pre-select default address
        const defaultAddr = data.find((a) => a.is_default);
        if (defaultAddr && !deliveryAddressId) {
          setDeliveryAddress(defaultAddr.id);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [customer?.id, open, deliveryAddressId, setDeliveryAddress]);

  // Fetch delivery charge
  useEffect(() => {
    if (channel !== 'delivery') {
      setDeliveryCharge(0);
      return;
    }
    apiClient
      .get<{ modifier_value: number; modifier_type: string }[]>('/catalog/channel-modifiers')
      .then((modifiers) => {
        const delivery = modifiers.find((m) => m.modifier_type === 'fixed' || m);
        if (delivery) {
          setDeliveryCharge(delivery.modifier_value);
        }
      })
      .catch(() => setDeliveryCharge(0));
  }, [channel]);

  const razorpay = useRazorpay({
    onSuccess: async (response) => {
      try {
        const order = await confirmOrder({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        onOpenChange(false);
        router.push(`/orders/${order.id}/track`);
      } catch {
        setError('Payment could not be completed. Try again.');
      } finally {
        setIsCheckingOut(false);
      }
    },
    onDismiss: () => {
      setIsCheckingOut(false);
    },
    onFailed: () => {
      setError('Payment could not be completed. Try again.');
      setIsCheckingOut(false);
    },
  });

  const handlePay = useCallback(async () => {
    if (!customer) {
      setShowLogin(true);
      return;
    }
    setError(null);
    setIsCheckingOut(true);
    try {
      const { razorpay_order_id } = await checkout();
      await razorpay.openCheckout({
        razorpayOrderId: razorpay_order_id,
        description: `Order - ${totalItems} item${totalItems !== 1 ? 's' : ''}`,
        prefill: {
          name: customer.name || undefined,
          contact: customer.phone,
          email: customer.email || undefined,
        },
      });
    } catch {
      setError('Could not create order. Try again.');
      setIsCheckingOut(false);
    }
  }, [customer, checkout, razorpay, totalItems]);

  const handleAuthenticated = useCallback((_customer: Customer) => {
    setShowLogin(false);
  }, []);

  const handleAddNewAddress = useCallback(
    async (payload: {
      label: 'Home' | 'Work' | 'Other';
      address: string;
      pincode: string;
      lat: number | null;
      lng: number | null;
    }) => {
      setServiceabilityError('');
      try {
        const newAddr = await apiClient.post<CustomerAddress>('/customer/addresses', payload);
        setAddresses((prev) => [...prev, newAddr]);
        setDeliveryAddress(newAddr.id);
      } catch {
        setServiceabilityError("Sorry, we don't deliver to this pincode yet.");
      }
    },
    [setDeliveryAddress],
  );

  const isLoading =
    isCheckingOut ||
    razorpay.state === 'loading-script' ||
    razorpay.state === 'creating-order' ||
    razorpay.state === 'confirming';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90vh] flex flex-col rounded-t-2xl"
      >
        {/* Handle bar */}
        <div className="mx-auto mt-3 mb-2 w-10 h-1 rounded-full bg-[var(--public-border-warm)]" />

        <SheetTitle className="text-xl font-semibold text-[var(--public-fg)] px-4">
          Your Cart
        </SheetTitle>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-4 space-y-4 flex-1 pb-4">
          {/* Cart items */}
          <div>
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between py-3 border-b border-[var(--public-border-light)]"
              >
                <span className="text-sm font-medium text-[var(--public-fg)] flex-1 truncate mr-3">
                  {item.name}
                </span>
                <div className="flex items-center gap-1 bg-[var(--public-terracotta)] text-white rounded-full px-2 py-1 text-sm shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      useCartStore.getState().updateQuantity(item.productId, item.quantity - 1)
                    }
                    aria-label={`Decrease quantity of ${item.name}`}
                    className="min-w-[24px] min-h-[24px] flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="min-w-[16px] text-center font-semibold text-xs">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      useCartStore.getState().updateQuantity(item.productId, item.quantity + 1)
                    }
                    aria-label={`Increase quantity of ${item.name}`}
                    className="min-w-[24px] min-h-[24px] flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-[var(--public-fg)] w-16 text-right">
                  &#8377;{(item.unitPrice * item.quantity).toFixed(0)}
                </span>
              </div>
            ))}
          </div>

          {/* Channel toggle */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--public-fg-subtle)] uppercase tracking-wide mb-2">
              Order type
            </h4>
            <ChannelToggle value={channel} onChange={setChannel} />
          </div>

          {/* Address selector (delivery only) */}
          {channel === 'delivery' && customer && (
            <div>
              <h4 className="text-sm font-semibold text-[var(--public-fg-subtle)] uppercase tracking-wide mb-2">
                Delivery address
              </h4>
              <AddressSelector
                addresses={addresses}
                selectedId={deliveryAddressId}
                onSelect={setDeliveryAddress}
                onAddNew={handleAddNewAddress}
                serviceabilityError={serviceabilityError}
              />
            </div>
          )}

          {/* Order summary */}
          <div>
            <div className="flex justify-between text-sm text-[var(--public-fg-subtle)]">
              <span>Subtotal</span>
              <span>&#8377;{subtotal.toFixed(0)}</span>
            </div>
            {channel === 'delivery' && deliveryCharge > 0 && (
              <div className="flex justify-between text-sm text-[var(--public-fg-subtle)] mt-1">
                <span>Delivery charge</span>
                <span>&#8377;{deliveryCharge.toFixed(0)}</span>
              </div>
            )}
            <div className="border-t border-[var(--public-border-warm)] my-2" />
            <div className="flex justify-between text-base font-semibold text-[var(--public-fg)]">
              <span>Total</span>
              <span>&#8377;{total.toFixed(0)}</span>
            </div>
          </div>

          {/* Login form inline */}
          {showLogin && !customer && (
            <div className="border border-[var(--public-border)] rounded-xl p-4 bg-white">
              <CustomerOtpForm
                onAuthenticated={handleAuthenticated}
                onCancel={() => setShowLogin(false)}
              />
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer: Pay CTA */}
        <div className="sticky bottom-0 bg-[var(--public-bg)] pt-3 pb-4 px-4 border-t border-[var(--public-border-light)]">
          <button
            type="button"
            onClick={() => void handlePay()}
            disabled={isLoading || totalItems === 0 || (!channel)}
            className="w-full h-12 rounded-xl bg-[var(--public-terracotta)] text-white text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-[var(--public-terracotta-hover)] transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </span>
            ) : !customer ? (
              'Log in to pay'
            ) : (
              `Pay \u20B9${total.toFixed(0)}`
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
