'use client';

import Link from 'next/link';
import { Package, Store, DollarSign } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  IMPORT_TYPE_CONFIG,
  IMPORT_TYPES,
  type ImportType,
} from '@/lib/types/imports';

const ICON_MAP: Record<ImportType, React.ReactNode> = {
  ingredients: <Package className="size-8 text-muted-foreground" />,
  vendors: <Store className="size-8 text-muted-foreground" />,
  vendor_pricing: <DollarSign className="size-8 text-muted-foreground" />,
};

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk import data from CSV or XLSX files
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {IMPORT_TYPES.map((type) => {
          const config = IMPORT_TYPE_CONFIG[type];
          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex flex-col gap-3">
                  {ICON_MAP[type]}
                  <div>
                    <h2 className="font-semibold text-lg">{config.label}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {config.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/import/${type}`}>
                  <Button variant="outline" className="w-full">
                    Import {config.label}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
