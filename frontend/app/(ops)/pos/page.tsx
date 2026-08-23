'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { X, Loader2, ShoppingCart, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PosProductGrid } from '@/components/ops/pos/PosProductGrid';
import { PosCartSidebar } from '@/components/ops/pos/PosCartSidebar';
import { apiClient } from '@/lib/api-client';
import { useUsageEvent } from '@/lib/hooks/use-usage-event';
import { USAGE_ACTIONS } from '@/lib/types/usage';
import type { Brand } from '@/lib/types/brand';
import type { ProductCategory, Product } from '@/lib/types/catalog';
import type { Zone } from '@/lib/types/zone';
import type {
  OrderChannel,
  CreateOrderPayload,
  AvailabilityMap,
  Order,
} from '@/lib/types/orders';

interface CartItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

export default function PosPage() {
  const queryClient = useQueryClient();
  const { trackAction } = useUsageEvent();

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [channel, setChannel] = useState<OrderChannel>('dine_in');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [showBorderBeam, setShowBorderBeam] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Channel-specific fields
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryAssignedTo, setDeliveryAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Queries
  const {
    data: brands = [],
    isLoading: brandsLoading,
    isError: brandsError,
    refetch: refetchBrands,
  } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
    select: (data) =>
      data.filter((b) => b.brand_type === 'food' && b.status === 'active'),
  });

  const effectiveBrandId = selectedBrandId || brands[0]?.id || '';

  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories', effectiveBrandId],
    queryFn: () =>
      apiClient.get<ProductCategory[]>(
        `/catalog/categories?brand_id=${effectiveBrandId}`,
      ),
    enabled: !!effectiveBrandId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['menu-items', effectiveBrandId],
    queryFn: () =>
      apiClient.get<Product[]>(`/catalog/products/staff?brand_id=${effectiveBrandId}`),
    enabled: !!effectiveBrandId,
  });

  const { data: availability = {} } = useQuery({
    queryKey: ['menu', 'availability-batch'],
    queryFn: () => apiClient.get<AvailabilityMap>('/catalog/availability'),
    // SPEC §6.4 polling floor. There is no `private-catalog` channel, so this is
    // a genuine poll — 30 s is as fast as it may run.
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  // Get first kitchen zone as default zone_id for orders
  const defaultZoneId =
    zones.find((z) => z.zone_type === 'kitchen')?.id || zones[0]?.id || '';

  // Place Order mutation
  const placeOrder = useMutation({
    mutationFn: (payload: CreateOrderPayload) =>
      apiClient.post<Order>('/orders', payload),
    onSuccess: (order) => {
      trackAction(USAGE_ACTIONS.ORDER_PLACE, { channel });
      toast.success(`Order #${order.order_number} placed`);
      setCartItems([]);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setDeliveryAssignedTo('');
      setNotes('');
      setShowBorderBeam(true);
      setCartOpen(false);
      setTimeout(() => setShowBorderBeam(false), 3000);
      void queryClient.invalidateQueries({
        queryKey: ['menu', 'availability-batch'],
      });
    },
    onError: () => {
      toast.error(
        'Could not place order. Check your connection and try again.',
      );
    },
  });

  // Cart helpers
  const addItem = useCallback((product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.base_price,
          quantity: 1,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback(
    (productId: string, delta: number) => {
      setCartItems((prev) => {
        const item = prev.find((i) => i.product_id === productId);
        if (!item) return prev;
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
          return prev.filter((i) => i.product_id !== productId);
        }
        return prev.map((i) =>
          i.product_id === productId ? { ...i, quantity: newQty } : i,
        );
      });
    },
    [],
  );

  const subtotal = cartItems.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0,
  );
  const totalItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const handlePlaceOrder = useCallback(() => {
    if (cartItems.length === 0) return;
    const payload: CreateOrderPayload = {
      channel,
      zone_id: defaultZoneId,
      items: cartItems.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      })),
      ...(tableNumber ? { table_number: tableNumber } : {}),
      ...(customerName ? { customer_name: customerName } : {}),
      ...(customerPhone ? { customer_phone: customerPhone } : {}),
      ...(deliveryAddress ? { delivery_address: deliveryAddress } : {}),
      ...(deliveryAssignedTo
        ? { delivery_assigned_to: deliveryAssignedTo }
        : {}),
      ...(notes ? { notes } : {}),
    };
    placeOrder.mutate(payload);
  }, [
    cartItems,
    channel,
    defaultZoneId,
    tableNumber,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryAssignedTo,
    notes,
    placeOrder,
  ]);

  const channelFields = {
    table_number: tableNumber,
    customer_name: customerName,
    customer_phone: customerPhone,
    delivery_address: deliveryAddress,
    delivery_assigned_to: deliveryAssignedTo,
  };

  const handleChannelFieldChange = useCallback(
    (field: string, value: string) => {
      switch (field) {
        case 'table_number':
          setTableNumber(value);
          break;
        case 'customer_name':
          setCustomerName(value);
          break;
        case 'customer_phone':
          setCustomerPhone(value);
          break;
        case 'delivery_address':
          setDeliveryAddress(value);
          break;
        case 'delivery_assigned_to':
          setDeliveryAssignedTo(value);
          break;
      }
    },
    [],
  );

  const cartSidebarProps = {
    cartItems,
    channel,
    onChannelChange: setChannel,
    channelFields,
    onChannelFieldChange: handleChannelFieldChange,
    notes,
    onNotesChange: setNotes,
    subtotal,
    onUpdateQuantity: updateQuantity,
    onPlaceOrder: handlePlaceOrder,
    isPlacing: placeOrder.isPending,
    showBorderBeam,
  };

  const fullScreenClass = isFullScreen
    ? 'fixed inset-0 z-50 bg-background overflow-hidden'
    : '';

  return (
    <div className={fullScreenClass}>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <h1 className="text-2xl font-bold leading-tight">
          {isFullScreen ? 'Terminal Mode' : 'Take Order'}
        </h1>
        <div className="flex items-center gap-2">
          {isFullScreen ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullScreen(false)}
              className="gap-1"
            >
              <X className="size-4" />
              Exit Terminal
            </Button>
          ) : (
            <Button
              variant="default"
              size="lg"
              onClick={() => setIsFullScreen(true)}
            >
              Terminal Mode
            </Button>
          )}
        </div>
      </div>

      {/* Split screen layout */}
      <div
        className={`flex ${isFullScreen ? 'h-[calc(100vh-3.5rem)]' : 'h-[calc(100vh-4rem)]'}`}
      >
        {/* Left panel: Menu Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {brandsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Loading menu...
            </div>
          ) : brandsError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Could not load the menu</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                Brands failed to load, so no products can be shown.
                <Button variant="outline" size="sm" onClick={() => void refetchBrands()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : !effectiveBrandId ? (
            <div className="py-16 text-center space-y-2">
              <ShoppingCart className="size-12 text-ink-faint mx-auto" />
              <h2 className="text-base font-semibold">No menu available</h2>
              <p className="text-sm text-muted-foreground">
                Add food brands and products in Operations to start taking orders.
              </p>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/operations/menu" />}
              >
                Set up the menu
              </Button>
            </div>
          ) : (
            <PosProductGrid
              brands={brands}
              categories={categories}
              items={products}
              selectedBrandId={effectiveBrandId}
              onBrandChange={setSelectedBrandId}
              availability={availability}
              onAddItem={addItem}
            />
          )}
        </div>

        {/* Desktop: Cart Sidebar */}
        <div className="hidden lg:flex w-80 min-w-[320px] border-l border-border flex-col">
          <PosCartSidebar {...cartSidebarProps} />
        </div>
      </div>

      {/* Mobile: Floating cart button */}
      {totalItems > 0 && (
        <button
          type="button"
          className="fixed bottom-6 right-6 lg:hidden z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold shadow-lg active:scale-95 transition-transform motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart className="size-4" />
          View Cart ({totalItems})
          <span className="font-mono tabular-nums">₹{subtotal}</span>
        </button>
      )}

      {/* Mobile: Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] p-0">
          <PosCartSidebar {...cartSidebarProps} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
