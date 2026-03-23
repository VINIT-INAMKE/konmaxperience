'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Store,
  DollarSign,
  Warehouse,
  Target,
  Flag,
  CheckSquare,
  TrendingUp,
  Calendar,
  ChefHat,
  LayoutGrid,
  UtensilsCrossed,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  IMPORT_TYPE_CONFIG,
  type ImportType,
  type PrerequisiteData,
} from '@/lib/types/imports';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ICON_MAP: Record<ImportType, React.ReactNode> = {
  ingredients: <Package className="size-8 text-muted-foreground" />,
  vendors: <Store className="size-8 text-muted-foreground" />,
  vendor_pricing: <DollarSign className="size-8 text-muted-foreground" />,
  opening_stock: <Warehouse className="size-8 text-muted-foreground" />,
  missions: <Target className="size-8 text-muted-foreground" />,
  quests: <Flag className="size-8 text-muted-foreground" />,
  tasks: <CheckSquare className="size-8 text-muted-foreground" />,
  kpis: <TrendingUp className="size-8 text-muted-foreground" />,
  events: <Calendar className="size-8 text-muted-foreground" />,
  recipes: <ChefHat className="size-8 text-muted-foreground" />,
  menu_categories: <LayoutGrid className="size-8 text-muted-foreground" />,
  menu_items: <UtensilsCrossed className="size-8 text-muted-foreground" />,
};

const TIERS: Array<{
  label: string;
  types: ImportType[];
  prerequisites?: Record<ImportType, { check: (p: PrerequisiteData) => boolean; label: string }>;
}> = [
  {
    label: 'Foundation Data',
    types: ['ingredients', 'vendors', 'vendor_pricing'],
  },
  {
    label: 'Operations \u2014 Independent',
    types: ['opening_stock', 'missions', 'kpis', 'events'],
  },
  {
    label: 'Operations \u2014 Sequenced',
    types: ['quests', 'tasks'],
    prerequisites: {
      quests: { check: (p) => p.missions > 0, label: 'Needs: Missions' },
      tasks: { check: (p) => p.missions > 0 && p.quests > 0, label: 'Needs: Missions + Quests' },
    } as Record<ImportType, { check: (p: PrerequisiteData) => boolean; label: string }>,
  },
  {
    label: 'Menu',
    types: ['recipes', 'menu_categories', 'menu_items'],
    prerequisites: {
      menu_categories: { check: (p) => p.brands > 0, label: 'Needs: Brands' },
      menu_items: { check: (p) => p.approved_recipes > 0 && p.menu_categories > 0, label: 'Needs: Approved Recipes + Menu Categories' },
    } as Record<ImportType, { check: (p: PrerequisiteData) => boolean; label: string }>,
  },
];

export default function AdminImportPage() {
  const [prereqs, setPrereqs] = useState<PrerequisiteData | null>(null);

  useEffect(() => {
    const fetchPrereqs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/imports/prerequisites`, { credentials: 'include' });
        if (res.ok) setPrereqs(await res.json());
      } catch {
        // silent — prerequisite display is informational
      }
    };
    fetchPrereqs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk import operational data from CSV or XLSX files
        </p>
        {prereqs && (
          <p className="text-xs text-muted-foreground mt-2">
            {prereqs.ingredients} ingredients &middot; {prereqs.vendors} vendors &middot; {prereqs.zones} zones &middot; {prereqs.brands} brands &middot; {prereqs.missions} missions &middot; {prereqs.approved_recipes} recipes (approved)
          </p>
        )}
      </div>

      {TIERS.map((tier) => (
        <div key={tier.label}>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {tier.label}
          </p>
          <Separator className="mt-1 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {tier.types.map((type) => {
              const config = IMPORT_TYPE_CONFIG[type];
              const prereqConfig = tier.prerequisites?.[type];
              const prereqMissing = prereqConfig && prereqs ? !prereqConfig.check(prereqs) : false;
              return (
                <Card key={type}>
                  <CardHeader>
                    <div className="flex flex-col gap-3">
                      {ICON_MAP[type]}
                      <div>
                        <h2 className="font-bold text-lg">{config.label}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {config.description}
                        </p>
                      </div>
                      {prereqMissing && prereqConfig && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 w-fit">
                          <AlertTriangle className="size-3 mr-1" />
                          {prereqConfig.label}
                        </Badge>
                      )}
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
      ))}
    </div>
  );
}
