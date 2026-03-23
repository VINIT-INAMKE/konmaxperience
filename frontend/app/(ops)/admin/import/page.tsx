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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  IMPORT_TYPE_CONFIG,
  type ImportType,
  type PrerequisiteData,
} from '@/lib/types/imports';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ICON_MAP: Record<ImportType, React.ReactNode> = {
  ingredients: <Package className="size-5" />,
  vendors: <Store className="size-5" />,
  vendor_pricing: <DollarSign className="size-5" />,
  opening_stock: <Warehouse className="size-5" />,
  missions: <Target className="size-5" />,
  quests: <Flag className="size-5" />,
  tasks: <CheckSquare className="size-5" />,
  kpis: <TrendingUp className="size-5" />,
  events: <Calendar className="size-5" />,
  recipes: <ChefHat className="size-5" />,
  menu_categories: <LayoutGrid className="size-5" />,
  menu_items: <UtensilsCrossed className="size-5" />,
};

const TIERS: Array<{
  label: string;
  types: ImportType[];
  accentColor: string;
  prerequisites?: Record<ImportType, { check: (p: PrerequisiteData) => boolean; label: string }>;
}> = [
  {
    label: 'Foundation Data',
    accentColor: 'border-l-amber-500',
    types: ['ingredients', 'vendors', 'vendor_pricing'],
  },
  {
    label: 'Operations \u2014 Independent',
    accentColor: 'border-l-blue-500',
    types: ['opening_stock', 'missions', 'kpis', 'events'],
  },
  {
    label: 'Operations \u2014 Sequenced',
    accentColor: 'border-l-blue-500',
    types: ['quests', 'tasks'],
    prerequisites: {
      quests: { check: (p) => p.missions > 0, label: 'Needs: Missions' },
      tasks: { check: (p) => p.missions > 0 && p.quests > 0, label: 'Needs: Missions + Quests' },
    } as Record<ImportType, { check: (p: PrerequisiteData) => boolean; label: string }>,
  },
  {
    label: 'Menu',
    accentColor: 'border-l-purple-500',
    types: ['recipes', 'menu_categories', 'menu_items'],
    prerequisites: {
      menu_categories: { check: (p) => p.brands > 0, label: 'Needs: Brands' },
      menu_items: { check: (p) => p.approved_recipes > 0 && p.menu_categories > 0, label: 'Needs: Recipes + Categories' },
    } as Record<ImportType, { check: (p: PrerequisiteData) => boolean; label: string }>,
  },
];

const TIER_HEADER_COLORS: Record<string, string> = {
  'Foundation Data': 'text-amber-500',
  'Operations \u2014 Independent': 'text-blue-500',
  'Operations \u2014 Sequenced': 'text-blue-500',
  'Menu': 'text-purple-500',
};

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk import operational data from CSV or XLSX files
        </p>
        {prereqs && (
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { label: 'Ingredients', value: prereqs.ingredients },
              { label: 'Vendors', value: prereqs.vendors },
              { label: 'Zones', value: prereqs.zones },
              { label: 'Brands', value: prereqs.brands },
              { label: 'Missions', value: prereqs.missions },
              { label: 'Quests', value: prereqs.quests },
              { label: 'Recipes (approved)', value: prereqs.approved_recipes },
              { label: 'Menu Categories', value: prereqs.menu_categories },
            ].map(({ label, value }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
              >
                <strong className={value > 0 ? 'text-green-600' : 'text-muted-foreground'}>{value}</strong>
                <span className="text-muted-foreground">{label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {TIERS.map((tier) => {
        const tierColor = TIER_HEADER_COLORS[tier.label] || 'text-muted-foreground';
        const tierComplete = prereqs && tier.types.every((type) => {
          const prereqConfig = tier.prerequisites?.[type];
          return !prereqConfig || prereqConfig.check(prereqs);
        });
        return (
          <div key={tier.label}>
            <div className="flex items-center gap-2 mb-3">
              <p className={`text-[11px] font-bold uppercase tracking-widest ${tierColor}`}>
                {tier.label}
              </p>
              {prereqs && tierComplete && (
                <span className="inline-block size-1.5 rounded-full bg-green-500" />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {tier.types.map((type) => {
                const config = IMPORT_TYPE_CONFIG[type];
                const prereqConfig = tier.prerequisites?.[type];
                const prereqMissing = prereqConfig && prereqs ? !prereqConfig.check(prereqs) : false;
                return (
                  <Link key={type} href={`/admin/import/${type}`}>
                    <Card className={`border-l-4 ${tier.accentColor} hover:bg-[var(--muted)] transition-colors cursor-pointer h-full`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5 text-muted-foreground">
                            {ICON_MAP[type]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm leading-tight">{config.label}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {config.description}
                            </p>
                            {prereqMissing && prereqConfig && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 mt-2 text-[10px] px-1.5 py-0 max-w-full truncate">
                                <AlertTriangle className="size-2.5 mr-1 shrink-0" />
                                <span className="truncate">{prereqConfig.label}</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
