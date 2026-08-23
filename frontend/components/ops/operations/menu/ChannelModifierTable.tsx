'use client';

import { useState } from 'react';
import { ChevronDown, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { ChannelModifier, ModifierType, OrderChannelValue } from '@/lib/types/catalog';
import { ORDER_CHANNEL_LABELS } from '@/lib/types/kds';

/** Prisma `OrderChannel` — ChannelModifier is unique on one row per channel. */
const CHANNEL_TYPES: readonly OrderChannelValue[] = [
  'dine_in',
  'takeaway',
  'delivery',
  'marketplace',
];
type ChannelType = OrderChannelValue;

const CHANNEL_LABELS: Record<ChannelType, string> = ORDER_CHANNEL_LABELS;

interface EditingState {
  channelType: ChannelType;
  modifierType: ModifierType;
  modifierValue: string;
}

interface ChannelModifierTableProps {
  modifiers: ChannelModifier[];
}

export function ChannelModifierTable({ modifiers }: ChannelModifierTableProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingRow, setEditingRow] = useState<ChannelType | null>(null);
  const [editState, setEditState] = useState<EditingState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getModifierForChannel = (channelType: ChannelType) =>
    modifiers.find((m) => m.channel === channelType) ?? null;

  const handleEdit = (channelType: ChannelType) => {
    const existing = getModifierForChannel(channelType);
    setEditingRow(channelType);
    setEditState({
      channelType,
      modifierType: existing?.modifier_type ?? 'fixed',
      modifierValue: existing ? String(existing.modifier_value) : '',
    });
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditState(null);
  };

  const handleSave = async () => {
    if (!editState) return;
    const value = parseFloat(editState.modifierValue);
    if (isNaN(value)) {
      toast.error('Please enter a valid number for the modifier value.');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.patch('/catalog/channel-modifiers', {
        channel: editState.channelType,
        modifier_type: editState.modifierType,
        modifier_value: value,
      });
      toast.success('Channel pricing updated.');
      void queryClient.invalidateQueries({ queryKey: ['channel-modifiers'] });
      setEditingRow(null);
      setEditState(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const formatEffectivePrice = (mod: ChannelModifier) => {
    if (mod.modifier_type === 'percentage') {
      return (
        <span className="text-xs text-muted-foreground">
          Base + {mod.modifier_value}%
        </span>
      );
    }
    return (
      <span className="text-xs text-muted-foreground">
        Base + ₹{mod.modifier_value}
      </span>
    );
  };

  return (
    <div className="space-y-3 border rounded-lg p-4">
      {/* Header */}
      <button
        className="flex items-center gap-2 w-full text-left rounded focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
      >
        <span className="text-base font-semibold">Channel Pricing</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform duration-200 ${
            isExpanded ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                  Channel
                </th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                  Modifier Type
                </th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                  Value
                </th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                  Effective Price
                </th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody>
              {CHANNEL_TYPES.map((channelType) => {
                const mod = getModifierForChannel(channelType);
                const isEditing = editingRow === channelType;

                return (
                  <tr key={channelType} className="border-b last:border-0">
                    {/* Channel */}
                    <td className="py-2 pr-4 font-medium">
                      {CHANNEL_LABELS[channelType]}
                    </td>

                    {/* Modifier Type */}
                    <td className="py-2 pr-4">
                      {isEditing && editState ? (
                        <Select
                          value={editState.modifierType}
                          onValueChange={(v) =>
                            setEditState((s) =>
                              s ? { ...s, modifierType: v as ModifierType } : s,
                            )
                          }
                          disabled={isSaving}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : mod ? (
                        mod.modifier_type === 'fixed' ? 'Fixed' : 'Percentage'
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </td>

                    {/* Value */}
                    <td className="py-2 pr-4">
                      {isEditing && editState ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editState.modifierValue}
                          onChange={(e) =>
                            setEditState((s) =>
                              s ? { ...s, modifierValue: e.target.value } : s,
                            )
                          }
                          className="h-7 w-24 text-xs"
                          disabled={isSaving}
                        />
                      ) : mod ? (
                        <span>
                          {mod.modifier_type === 'percentage'
                            ? `${mod.modifier_value}%`
                            : `+${mod.modifier_value}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Effective Price */}
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : mod ? (
                        formatEffectivePrice(mod)
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Edit / Save / Cancel */}
                    <td className="py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => void handleSave()}
                            disabled={isSaving}
                            aria-label="Save"
                          >
                            <Save className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={handleCancel}
                            disabled={isSaving}
                            aria-label="Cancel"
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                          onClick={() => handleEdit(channelType)}
                          aria-label={`Edit ${CHANNEL_LABELS[channelType]} pricing`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
