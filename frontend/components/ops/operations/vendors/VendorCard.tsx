'use client';

import { Eye, Pencil, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { Vendor } from '@/lib/types/vendor';

interface VendorCardProps {
  vendor: Vendor;
  onView: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
  onDeactivate: (vendor: Vendor) => void;
  isAdmin: boolean;
}

export function VendorCard({
  vendor,
  onView,
  onEdit,
  onDeactivate,
  isAdmin,
}: VendorCardProps) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm font-medium">{vendor.name}</td>
      <td className="px-4 py-3 text-sm text-ink-muted">
        {vendor.phone ?? <span className="text-ink-muted/50">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-ink-muted">
        {vendor.email ?? <span className="text-ink-muted/50">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-ink-muted">
        {vendor.payment_terms ?? <span className="text-ink-muted/50">—</span>}
      </td>
      <td className="px-4 py-3">
        <Badge
          className={`text-xs ${
            vendor.status === 'active' ? STATUS_BADGE.good : STATUS_BADGE.neutral
          }`}
        >
          {vendor.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(vendor)}
            className="p-1.5 rounded text-ink-muted hover:text-foreground hover:bg-muted transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            aria-label="View vendor details"
          >
            <Eye className="size-3.5" />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(vendor)}
                className="p-1.5 rounded text-ink-muted hover:text-foreground hover:bg-muted transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                aria-label="Edit vendor"
              >
                <Pencil className="size-3.5" />
              </button>
              {vendor.status === 'active' && (
                <button
                  onClick={() => onDeactivate(vendor)}
                  className="p-1.5 rounded text-ink-muted hover:text-warning transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                  aria-label="Deactivate vendor"
                  title="Deactivate"
                >
                  <PowerOff className="size-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
