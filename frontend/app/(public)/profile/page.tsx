'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  CheckCircle2,
  Pencil,
  Plus,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { useCartStore } from '@/lib/stores/cart-store';
import { CustomerOtpForm } from '@/components/public/CustomerOtpForm';
import { CustomerOrderCard } from '@/components/public/CustomerOrderCard';
import { CustomerAddressCard } from '@/components/public/CustomerAddressCard';
import { GooglePlacesInput } from '@/components/public/GooglePlacesInput';
import { apiClient } from '@/lib/api-client';
import type { Customer } from '@/lib/types/customer-auth';
import type { CustomerOrder, CustomerAddress } from '@/lib/types/marketplace';
import type { BookingStatus, BookingPaymentStatus } from '@/lib/types/events';
import { BOOKING_STATUS_LABELS } from '@/lib/types/events';
import { productImage } from '@/lib/types/catalog';
import type { Product } from '@/lib/types/catalog';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Booking type from backend (event booking with nested event)
// ---------------------------------------------------------------------------
interface CustomerBooking {
  id: string;
  event_id: string;
  customer_id: string;
  guests: number;
  /** EventBooking.payment_amount — the API has no `total_amount` column. */
  payment_amount: number | null;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  hold_expires_at: string | null;
  customer_name: string | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    date: string;
  };
}

// ---------------------------------------------------------------------------
// Address form types
// ---------------------------------------------------------------------------
interface AddressFormData {
  label: 'Home' | 'Work' | 'Other';
  address: string;
  landmark: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { customer, isLoading, fetchProfile, updateProfile, logout } =
    useCustomerAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  // Re-order dialog state
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [pendingReorder, setPendingReorder] = useState<CustomerOrder | null>(
    null,
  );

  // Address add dialog state
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormData>({
    label: 'Home',
    address: '',
    landmark: '',
    pincode: '',
    lat: null,
    lng: null,
  });

  // Address edit state
  const [editingAddress, setEditingAddress] =
    useState<CustomerAddress | null>(null);
  const [editAddressForm, setEditAddressForm] = useState<AddressFormData>({
    label: 'Home',
    address: '',
    landmark: '',
    pincode: '',
    lat: null,
    lng: null,
  });

  // Delete confirm dialog state
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (customer?.name) {
      setNameValue(customer.name);
    }
  }, [customer?.name]);

  // ---------------------------------------------------------------------------
  // Data queries
  // ---------------------------------------------------------------------------
  const {
    data: orders = [],
    isLoading: ordersLoading,
  } = useQuery({
    queryKey: ['customer-orders'],
    queryFn: () => apiClient.get<CustomerOrder[]>('/customer/orders'),
    enabled: !!customer,
  });

  const {
    data: addresses = [],
    isLoading: addressesLoading,
  } = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: () => apiClient.get<CustomerAddress[]>('/customer/addresses'),
    enabled: !!customer,
  });

  const {
    data: bookings = [],
    isLoading: bookingsLoading,
  } = useQuery({
    queryKey: ['customer-bookings'],
    queryFn: () => apiClient.get<CustomerBooking[]>('/customer/bookings'),
    enabled: !!customer,
  });

  // ---------------------------------------------------------------------------
  // Address mutations
  // ---------------------------------------------------------------------------
  const createAddressMutation = useMutation({
    mutationFn: (data: AddressFormData) =>
      apiClient.post<CustomerAddress>('/customer/addresses', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
      setAddressDialogOpen(false);
      setAddressForm({
        label: 'Home',
        address: '',
        landmark: '',
        pincode: '',
        lat: null,
        lng: null,
      });
      toast.success('Address added');
    },
    onError: () => toast.error('Failed to add address'),
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AddressFormData>;
    }) => apiClient.patch<CustomerAddress>(`/customer/addresses/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
      setEditingAddress(null);
      toast.success('Address updated');
    },
    onError: () => toast.error('Failed to update address'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/customer/addresses/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
      setDeletingAddressId(null);
      toast.success('Address removed');
    },
    onError: () => toast.error('Failed to remove address'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/customer/addresses/${id}/default`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
      toast.success('Default address updated');
    },
    onError: () => toast.error('Failed to set default address'),
  });

  // ---------------------------------------------------------------------------
  // Profile actions
  // ---------------------------------------------------------------------------
  const handleSaveName = useCallback(async () => {
    if (!nameValue.trim()) return;
    setSavingName(true);
    try {
      await updateProfile({ name: nameValue.trim() });
      setEditingName(false);
    } catch {
      // silently fail
    } finally {
      setSavingName(false);
    }
  }, [nameValue, updateProfile]);

  const handleLogout = useCallback(async () => {
    await logout();
    setLoggedOut(true);
  }, [logout]);

  const handleAuthenticated = useCallback(
    (_c: Customer) => {
      setLoggedOut(false);
      void fetchProfile();
    },
    [fetchProfile],
  );

  // ---------------------------------------------------------------------------
  // Re-order flow
  // ---------------------------------------------------------------------------
  const handleReorder = useCallback(
    async (order: CustomerOrder) => {
      // Fetch current products to check availability
      let products: Product[] = [];
      try {
        products = await apiClient.get<Product[]>('/catalog/products');
      } catch {
        toast.error('Could not check item availability');
        return;
      }

      const menuMap = new Map(products.map((m) => [m.id, m]));

      // Build list of available items from the order
      const availableItems: Array<{
        productId: string;
        name: string;
        unitPrice: number;
        imageUrl: string | null;
      }> = [];
      const skippedNames: string[] = [];

      for (const item of order.items) {
        const mi = menuMap.get(item.product_id);
        if (mi && mi.status === 'active') {
          availableItems.push({
            productId: mi.id,
            name: mi.name,
            unitPrice: mi.base_price,
            imageUrl: productImage(mi),
          });
        } else {
          skippedNames.push(item.product.name);
        }
      }

      if (availableItems.length === 0) {
        toast.error('All items from this order are currently unavailable');
        return;
      }

      const currentItems = useCartStore.getState().items;

      if (currentItems.length > 0) {
        // Cart has items -- show dialog
        setPendingReorder(order);
        setReorderDialogOpen(true);
        return;
      }

      // Cart is empty -- add items silently
      addReorderItems(availableItems, skippedNames);
    },
    [],
  );

  const addReorderItems = useCallback(
    (
      items: Array<{
        productId: string;
        name: string;
        unitPrice: number;
        imageUrl: string | null;
      }>,
      skippedNames: string[],
    ) => {
      const store = useCartStore.getState();
      for (const item of items) {
        store.addItem(item);
      }
      // Toast for skipped items
      for (const name of skippedNames) {
        toast.info(`${name} was skipped -- currently unavailable`);
      }
      if (items.length > 0) {
        toast.success(`${items.length} item${items.length > 1 ? 's' : ''} added to cart`);
      }
      router.push('/menu');
    },
    [router],
  );

  const handleReorderDialogAction = useCallback(
    async (action: 'add' | 'replace' | 'cancel') => {
      setReorderDialogOpen(false);
      if (action === 'cancel' || !pendingReorder) {
        setPendingReorder(null);
        return;
      }

      // Re-fetch availability
      let products: Product[] = [];
      try {
        products = await apiClient.get<Product[]>('/catalog/products');
      } catch {
        toast.error('Could not check item availability');
        return;
      }

      const menuMap = new Map(products.map((m) => [m.id, m]));
      const availableItems: Array<{
        productId: string;
        name: string;
        unitPrice: number;
        imageUrl: string | null;
      }> = [];
      const skippedNames: string[] = [];

      for (const item of pendingReorder.items) {
        const mi = menuMap.get(item.product_id);
        if (mi && mi.status === 'active') {
          availableItems.push({
            productId: mi.id,
            name: mi.name,
            unitPrice: mi.base_price,
            imageUrl: productImage(mi),
          });
        } else {
          skippedNames.push(item.product.name);
        }
      }

      if (action === 'replace') {
        useCartStore.getState().clearCart();
      }

      addReorderItems(availableItems, skippedNames);
      setPendingReorder(null);
    },
    [pendingReorder, addReorderItems],
  );

  // ---------------------------------------------------------------------------
  // Address actions
  // ---------------------------------------------------------------------------
  const handlePlaceSelect = useCallback(
    (result: {
      formattedAddress: string;
      pincode: string;
      lat: number | null;
      lng: number | null;
    }) => {
      setAddressForm((prev) => ({
        ...prev,
        address: result.formattedAddress,
        pincode: result.pincode,
        lat: result.lat,
        lng: result.lng,
      }));
    },
    [],
  );

  const handleEditPlaceSelect = useCallback(
    (result: {
      formattedAddress: string;
      pincode: string;
      lat: number | null;
      lng: number | null;
    }) => {
      setEditAddressForm((prev) => ({
        ...prev,
        address: result.formattedAddress,
        pincode: result.pincode,
        lat: result.lat,
        lng: result.lng,
      }));
    },
    [],
  );

  const startEditAddress = useCallback((addr: CustomerAddress) => {
    setEditingAddress(addr);
    setEditAddressForm({
      label: addr.label,
      address: addr.address,
      landmark: addr.landmark || '',
      pincode: addr.pincode,
      lat: addr.lat,
      lng: addr.lng,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Loading / logged out states
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-[var(--public-muted)]" />
      </div>
    );
  }

  if (!customer || loggedOut) {
    return (
      <div className="max-w-sm mx-auto px-4 py-8">
        <CustomerOtpForm onAuthenticated={handleAuthenticated} />
      </div>
    );
  }

  const initials = customer.name
    ? customer.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : customer.phone.slice(-2);

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--public-fg)]">
          Your account
        </h1>

        {/* Identity section */}
        <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-12 bg-[var(--public-surface)] text-[var(--public-fg)]">
              <AvatarFallback className="text-base font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-[var(--public-fg)]">
                  +91 {customer.phone}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
                  <CheckCircle2 className="size-3.5" />
                  Verified
                </span>
              </div>

              {editingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    disabled={savingName}
                    className="h-8 text-sm border-[var(--public-border)] bg-white"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSaveName()}
                    disabled={savingName || !nameValue.trim()}
                    className="h-8 text-xs bg-[var(--public-terracotta)] text-white hover:bg-[var(--public-terracotta)]/90"
                  >
                    {savingName ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      'Save name'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setNameValue(customer.name || '');
                    }}
                    className="text-xs text-[var(--public-muted)] hover:text-[var(--public-terracotta)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {customer.name ? (
                    <>
                      <span className="text-base text-[var(--public-fg)]">
                        {customer.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingName(true)}
                        aria-label="Edit name"
                        className="text-[var(--public-muted)] hover:text-[var(--public-terracotta)]"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="text-sm text-[var(--public-terracotta)] hover:underline"
                    >
                      Add your name
                    </button>
                  )}
                </div>
              )}

              {customer.email && (
                <p className="text-sm text-[var(--public-muted)]">
                  {customer.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders">
          <TabsList className="w-full bg-[var(--public-surface)] rounded-xl p-1 border border-[var(--public-border)]">
            <TabsTrigger
              value="orders"
              className="flex-1 data-active:bg-white data-active:rounded-lg data-active:shadow-sm data-active:text-[var(--public-fg)] data-active:font-medium text-[var(--public-muted)] hover:text-[var(--public-fg-subtle)]"
            >
              Orders
            </TabsTrigger>
            <TabsTrigger
              value="addresses"
              className="flex-1 data-active:bg-white data-active:rounded-lg data-active:shadow-sm data-active:text-[var(--public-fg)] data-active:font-medium text-[var(--public-muted)] hover:text-[var(--public-fg-subtle)]"
            >
              Addresses
            </TabsTrigger>
            <TabsTrigger
              value="bookings"
              className="flex-1 data-active:bg-white data-active:rounded-lg data-active:shadow-sm data-active:text-[var(--public-fg)] data-active:font-medium text-[var(--public-muted)] hover:text-[var(--public-fg-subtle)]"
            >
              Bookings
            </TabsTrigger>
          </TabsList>

          {/* ----- Orders tab ----- */}
          <TabsContent value="orders" className="mt-4 space-y-3">
            {ordersLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            )}
            {!ordersLoading && orders.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-base font-semibold text-[var(--public-fg)]">
                  No orders yet
                </p>
                <p className="text-sm text-[var(--public-muted)]">
                  Your past orders will appear here after your first purchase.
                </p>
              </div>
            )}
            {!ordersLoading &&
              orders.map((order) => (
                <CustomerOrderCard
                  key={order.id}
                  order={order}
                  onReorder={handleReorder}
                />
              ))}
          </TabsContent>

          {/* ----- Addresses tab ----- */}
          <TabsContent value="addresses" className="mt-4 space-y-3">
            {addressesLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            )}
            {!addressesLoading && addresses.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-base font-semibold text-[var(--public-fg)]">
                  No saved addresses
                </p>
                <p className="text-sm text-[var(--public-muted)]">
                  Add an address to check delivery availability.
                </p>
              </div>
            )}
            {!addressesLoading &&
              addresses.map((addr) =>
                editingAddress?.id === addr.id ? (
                  // Inline edit form
                  <div
                    key={addr.id}
                    className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 space-y-3"
                  >
                    <div className="flex gap-2">
                      {(['Home', 'Work', 'Other'] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() =>
                            setEditAddressForm((prev) => ({
                              ...prev,
                              label: l,
                            }))
                          }
                          className={`text-xs px-3 py-1 rounded-full border ${
                            editAddressForm.label === l
                              ? 'bg-[var(--public-terracotta)] text-white border-[var(--public-terracotta)]'
                              : 'border-[var(--public-border)] text-[var(--public-fg-subtle)]'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <GooglePlacesInput onPlaceSelect={handleEditPlaceSelect} />
                    {editAddressForm.address && (
                      <p className="text-xs text-[var(--public-fg-subtle)]">
                        {editAddressForm.address}
                      </p>
                    )}
                    <Input
                      type="text"
                      placeholder="Landmark (optional)"
                      value={editAddressForm.landmark}
                      onChange={(e) =>
                        setEditAddressForm((prev) => ({
                          ...prev,
                          landmark: e.target.value,
                        }))
                      }
                      className="h-9 text-sm border-[var(--public-border)] bg-white"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          updateAddressMutation.mutate({
                            id: addr.id,
                            data: editAddressForm,
                          })
                        }
                        disabled={
                          !editAddressForm.address ||
                          updateAddressMutation.isPending
                        }
                        className="h-8 text-xs bg-[var(--public-terracotta)] text-white"
                      >
                        {updateAddressMutation.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setEditingAddress(null)}
                        className="text-xs text-[var(--public-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <CustomerAddressCard
                    key={addr.id}
                    address={addr}
                    onSetDefault={(id) => setDefaultMutation.mutate(id)}
                    onEdit={startEditAddress}
                    onDelete={(id) => setDeletingAddressId(id)}
                  />
                ),
              )}

            {/* Add new address button */}
            {!addressesLoading && (
              <button
                type="button"
                onClick={() => setAddressDialogOpen(true)}
                className="w-full rounded-xl border-2 border-dashed border-[var(--public-border-warm)] text-sm text-[var(--public-muted)] hover:border-[var(--public-terracotta)] py-4 text-center transition-colors"
              >
                <Plus className="size-4 inline-block mr-1.5 -mt-0.5" />
                Add new address
              </button>
            )}
          </TabsContent>

          {/* ----- Bookings tab ----- */}
          <TabsContent value="bookings" className="mt-4 space-y-3">
            {bookingsLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            )}
            {!bookingsLoading && bookings.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-base font-semibold text-[var(--public-fg)]">
                  No bookings yet
                </p>
                <p className="text-sm text-[var(--public-muted)]">
                  Event bookings you make will appear here.
                </p>
              </div>
            )}
            {!bookingsLoading &&
              bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--public-fg)]">
                      {booking.event.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        booking.status === 'confirmed' || booking.status === 'attended'
                          ? 'bg-[var(--status-good)]/12 text-[var(--status-good)]'
                          : booking.status === 'cancelled' || booking.status === 'no_show'
                            ? 'bg-[var(--status-serious)]/12 text-[var(--status-serious)]'
                            : 'bg-[var(--status-warning)]/12 text-[var(--status-warning)]'
                      }`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--public-muted)]">
                    {new Date(booking.event.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    &middot; {booking.guests} guest
                    {booking.guests !== 1 ? 's' : ''}
                  </p>
                  <p className="text-base font-semibold text-[var(--public-fg)]">
                    {'\u20B9'}
                    {Number(booking.payment_amount ?? 0).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `${API_BASE_URL}/customer/bookings/${booking.id}/receipt`,
                        '_blank',
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs border border-[var(--public-border)] text-[var(--public-fg-subtle)] rounded-lg px-3 py-1.5 hover:bg-[var(--public-surface)]"
                  >
                    <Receipt className="size-3" />
                    Receipt
                    <ExternalLink className="size-2.5" />
                  </button>
                </div>
              ))}
          </TabsContent>
        </Tabs>

        {/* Log out */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-sm text-[var(--destructive)]"
        >
          Log out
        </button>
      </div>

      {/* ===== Re-order dialog ===== */}
      <Dialog
        open={reorderDialogOpen}
        onOpenChange={setReorderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your cart has items</DialogTitle>
            <DialogDescription>
              Would you like to add these items to your existing cart or replace
              it?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              onClick={() => void handleReorderDialogAction('add')}
              className="bg-[var(--public-terracotta)] text-white hover:bg-[var(--public-terracotta-hover)]"
            >
              Add to cart
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleReorderDialogAction('replace')}
            >
              Replace cart
            </Button>
            <button
              type="button"
              onClick={() => void handleReorderDialogAction('cancel')}
              className="text-sm text-[var(--public-muted)] hover:text-[var(--public-fg-subtle)] py-2"
            >
              Keep browsing
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Add address dialog ===== */}
      <Dialog
        open={addressDialogOpen}
        onOpenChange={setAddressDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new address</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Label selector */}
            <div className="flex gap-2">
              {(['Home', 'Work', 'Other'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() =>
                    setAddressForm((prev) => ({ ...prev, label: l }))
                  }
                  className={`text-xs px-3 py-1 rounded-full border ${
                    addressForm.label === l
                      ? 'bg-[var(--public-terracotta)] text-white border-[var(--public-terracotta)]'
                      : 'border-[var(--public-border)] text-[var(--public-fg-subtle)]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Google Places input */}
            <GooglePlacesInput onPlaceSelect={handlePlaceSelect} />

            {addressForm.address && (
              <p className="text-xs text-[var(--public-fg-subtle)]">
                {addressForm.address}
              </p>
            )}

            {/* Landmark */}
            <Input
              type="text"
              placeholder="Landmark (optional)"
              value={addressForm.landmark}
              onChange={(e) =>
                setAddressForm((prev) => ({
                  ...prev,
                  landmark: e.target.value,
                }))
              }
              className="h-9 text-sm border-[var(--public-border)] bg-white"
            />

            <Button
              type="button"
              onClick={() => createAddressMutation.mutate(addressForm)}
              disabled={
                !addressForm.address || createAddressMutation.isPending
              }
              className="w-full bg-[var(--public-terracotta)] text-white hover:bg-[var(--public-terracotta-hover)]"
            >
              {createAddressMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Save address'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Delete address confirm dialog ===== */}
      <Dialog
        open={!!deletingAddressId}
        onOpenChange={(open) => {
          if (!open) setDeletingAddressId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this address?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1 text-[var(--destructive)] border-[var(--destructive)]"
              onClick={() => {
                if (deletingAddressId) {
                  deleteAddressMutation.mutate(deletingAddressId);
                }
              }}
              disabled={deleteAddressMutation.isPending}
            >
              {deleteAddressMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                'Remove'
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeletingAddressId(null)}
            >
              Keep address
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
