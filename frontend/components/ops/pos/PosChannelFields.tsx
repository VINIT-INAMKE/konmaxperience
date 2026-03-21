'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import type { OrderChannel } from '@/lib/types/orders';

interface ChannelFields {
  table_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_assigned_to: string;
}

interface PosChannelFieldsProps {
  channel: OrderChannel;
  onChannelChange: (channel: OrderChannel) => void;
  fields: ChannelFields;
  onFieldChange: (field: string, value: string) => void;
}

export function PosChannelFields({
  channel,
  onChannelChange,
  fields,
  onFieldChange,
}: PosChannelFieldsProps) {
  return (
    <div className="space-y-3">
      {/* Channel selector */}
      <Tabs
        value={channel}
        onValueChange={(v) => onChannelChange(v as OrderChannel)}
      >
        <TabsList className="w-full h-8">
          <TabsTrigger value="dine_in" className="flex-1 text-xs">
            Dine-in
          </TabsTrigger>
          <TabsTrigger value="takeaway" className="flex-1 text-xs">
            Takeaway
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex-1 text-xs">
            Delivery
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Customer name - shown for all channels */}
      <Input
        placeholder="Customer name (optional)"
        value={fields.customer_name}
        onChange={(e) => onFieldChange('customer_name', e.target.value)}
      />

      {/* Conditional channel-specific fields */}
      {channel === 'dine_in' && (
        <Input
          placeholder="Table number"
          value={fields.table_number}
          onChange={(e) => onFieldChange('table_number', e.target.value)}
        />
      )}

      {channel === 'takeaway' && (
        <Input
          placeholder="Customer phone"
          value={fields.customer_phone}
          onChange={(e) => onFieldChange('customer_phone', e.target.value)}
        />
      )}

      {channel === 'delivery' && (
        <>
          <Input
            placeholder="Customer phone"
            value={fields.customer_phone}
            onChange={(e) => onFieldChange('customer_phone', e.target.value)}
          />
          <textarea
            className="flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
            placeholder="Delivery address"
            value={fields.delivery_address}
            onChange={(e) =>
              onFieldChange('delivery_address', e.target.value)
            }
          />
          <Input
            placeholder="Rider or staff name"
            value={fields.delivery_assigned_to}
            onChange={(e) =>
              onFieldChange('delivery_assigned_to', e.target.value)
            }
          />
        </>
      )}
    </div>
  );
}
