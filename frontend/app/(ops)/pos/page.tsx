'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Button } from '@/components/ui/button';
import { PosMenuGrid } from '@/components/ops/pos/PosMenuGrid';
import { PosCartSidebar } from '@/components/ops/pos/PosCartSidebar';
import { apiClient } from '@/lib/api-client';
import type { Brand } from '@/lib/types/brand';
import type { MenuCategory, MenuItem } from '@/lib/types/menu';
import type { Zone } from '@/lib/types/zone';
import type {
  OrderChannel,
  CreateOrderPayload,
  AvailabilityMap,
  Order,
} from '@/lib/types/orders';

interface CartItem {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

export default function PosPage() {
  const queryClient = useQueryClient();

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [channel, setChannel] = useState<OrderChannel>('dine_in');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [showBorderBeam, setShowBorderBeam] = useState(false);

  // Channel-specific fields
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryAssignedTo, setDeliveryAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Queries
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
    select: (data) =>
      data.filter((b) => b.brand_type === 'food' && b.status === 'active'),
  });

  const effectiveBrandId = selectedBrandId || brands[0]?.id || '';

  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories', effectiveBrandId],
    queryFn: () =>
      apiClient.get<MenuCategory[]>(
        `/menu/categories?brand_id=${effectiveBrandId}`,
      ),
    enabled: !!effectiveBrandId,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items', effectiveBrandId],
    queryFn: () =>
      apiClient.get<MenuItem[]>(`/menu/items?brand_id=${effectiveBrandId}`),
    enabled: !!effectiveBrandId,
  });

  const { data: availability = {} } = useQuery({
    queryKey: ['menu', 'availability-batch'],
    queryFn: () => apiClient.get<AvailabilityMap>('/menu/availability'),
    refetchInterval: 10000,
    staleTime: 8000,
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
      const shortId = order.id.slice(-4).toUpperCase();
      toast.success(`Order #${shortId} placed`);
      setCartItems([]);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setDeliveryAssignedTo('');
      setNotes('');
      setShowBorderBeam(true);
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
  const addItem = useCallback((menuItem: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.menu_item_id === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menu_item_id === menuItem.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          menu_item_id: menuItem.id,
          name: menuItem.name,
          unit_price: menuItem.base_price,
          quantity: 1,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback(
    (menuItemId: string, delta: number) => {
      setCartItems((prev) => {
        const item = prev.find((i) => i.menu_item_id === menuItemId);
        if (!item) return prev;
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
          return prev.filter((i) => i.menu_item_id !== menuItemId);
        }
        return prev.map((i) =>
          i.menu_item_id === menuItemId ? { ...i, quantity: newQty } : i,
        );
      });
    },
    [],
  );

  const subtotal = cartItems.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0,
  );

  const handlePlaceOrder = useCallback(() => {
    if (cartItems.length === 0) return;
    const payload: CreateOrderPayload = {
      channel,
      zone_id: defaultZoneId,
      items: cartItems.map((i) => ({
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
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

  const fullScreenClass = isFullScreen
    ? 'fixed inset-0 z-50 bg-background overflow-hidden'
    : '';

  return (
    <div className={fullScreenClass}>
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-[20px] font-bold leading-tight">
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
            <ShimmerButton
              className="h-9 text-sm px-4"
              onClick={() => setIsFullScreen(true)}
            >
              Terminal Mode
            </ShimmerButton>
          )}
        </div>
      </div>

      {/* Split screen layout */}
      <div
        className={`flex ${isFullScreen ? 'h-[calc(100vh-3.5rem)]' : 'h-[calc(100vh-4rem)]'}`}
      >
        {/* Left panel: Menu Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {!effectiveBrandId ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Loading menu...
            </div>
          ) : (
            <PosMenuGrid
              brands={brands}
              categories={categories}
              items={menuItems}
              selectedBrandId={effectiveBrandId}
              onBrandChange={setSelectedBrandId}
              availability={availability}
              onAddItem={addItem}
            />
          )}
        </div>

        {/* Right panel: Cart Sidebar */}
        <div className="w-80 min-w-[320px] border-l border-border flex flex-col">
          <PosCartSidebar
            cartItems={cartItems}
            channel={channel}
            onChannelChange={setChannel}
            channelFields={channelFields}
            onChannelFieldChange={handleChannelFieldChange}
            notes={notes}
            onNotesChange={setNotes}
            subtotal={subtotal}
            onUpdateQuantity={updateQuantity}
            onPlaceOrder={handlePlaceOrder}
            isPlacing={placeOrder.isPending}
            showBorderBeam={showBorderBeam}
          />
        </div>
      </div>
    </div>
  );
}
