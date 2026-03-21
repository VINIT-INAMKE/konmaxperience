'use client';

import { Eye, Pencil, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {vendor.phone ?? <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {vendor.email ?? <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {vendor.payment_terms ?? <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="px-4 py-3">
        <Badge
          className={`text-xs border-0 ${
            vendor.status === 'active'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {vendor.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(vendor)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="View vendor details"
          >
            <Eye className="size-3.5" />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(vendor)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Edit vendor"
              >
                <Pencil className="size-3.5" />
              </button>
              {vendor.status === 'active' && (
                <button
                  onClick={() => onDeactivate(vendor)}
                  className="p-1.5 rounded text-muted-foreground hover:text-amber-500 transition-colors"
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
