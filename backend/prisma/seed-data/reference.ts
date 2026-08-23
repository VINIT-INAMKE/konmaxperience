import type { MeterMode } from '@prisma/client';

export interface ReadinessMeterSeed {
  code: string;
  name: string;
  description: string;
  /** SPEC §4.3 — `derived` meters are computed, `hybrid` blends 50/50 with the task-driven score. */
  mode: MeterMode;
  /** Formula registry key for `derived`/`hybrid` meters; null for pure `task_driven`. */
  formula_key: string | null;
}

export const READINESS_METERS: ReadinessMeterSeed[] = [
  { code: 'VILLA', name: 'Villa Readiness', description: 'Overall villa setup and space readiness', mode: 'task_driven', formula_key: null },
  { code: 'BACKEND', name: 'Backend Readiness', description: 'Food production, R&D, and standardization readiness', mode: 'hybrid', formula_key: 'hybrid_backend_v1' },
  { code: 'FRONTEND', name: 'Frontend Readiness', description: 'Customer-facing service and experience readiness', mode: 'hybrid', formula_key: 'hybrid_frontend_v1' },
  { code: 'PROCUREMENT', name: 'Procurement Readiness', description: 'Vendor sourcing and inventory readiness', mode: 'derived', formula_key: 'procurement_v1' },
  { code: 'STANDARDIZATION', name: 'Standardization Readiness', description: 'SOPs, recipes, and process documentation readiness', mode: 'derived', formula_key: 'standardization_v1' },
  { code: 'SALES', name: 'Sales Readiness', description: 'Sales channels and revenue pipeline readiness', mode: 'derived', formula_key: 'sales_v1' },
  { code: 'QUALITY', name: 'Quality Readiness', description: 'Waste, food-cost variance and guest ratings', mode: 'derived', formula_key: 'quality_v1' },
  { code: 'BI', name: 'BI Readiness', description: 'Costing, pricing and KPI instrumentation readiness', mode: 'task_driven', formula_key: null },
  { code: 'TECH', name: 'Tech Readiness', description: 'Dashboard, automation, and system infrastructure readiness', mode: 'task_driven', formula_key: null },
  { code: 'TALENT', name: 'Talent Readiness', description: 'Team hiring, training, and onboarding readiness', mode: 'task_driven', formula_key: null },
  { code: 'ART_EXPERIENCE', name: 'Art Experience Readiness', description: 'Art program and experience design readiness', mode: 'task_driven', formula_key: null },
  { code: 'LIFESTYLE_EXPERIENCE', name: 'Lifestyle Experience Readiness', description: 'Lifestyle program and experience design readiness', mode: 'task_driven', formula_key: null },
];

export const ZONES = [
  { name: 'Main Kitchen', zone_type: 'kitchen' },
  { name: 'Prep Station', zone_type: 'kitchen' },
  { name: 'Dining Hall', zone_type: 'dining' },
  { name: 'Garden Terrace', zone_type: 'outdoor' },
  { name: 'Workshop Studio', zone_type: 'workspace' },
  { name: 'Cold Storage', zone_type: 'storage' },
  { name: 'Office', zone_type: 'workspace' },
  { name: 'Lounge', zone_type: 'leisure' },
];

export const BRANDS = [
  { name: 'Konma Food', brand_type: 'food', status: 'active' },
  { name: 'Just Craves', brand_type: 'food', status: 'active' },
];

export const CHANNELS = [
  { name: 'Dine-in', channel_type: 'dine_in', status: 'planned' },
  { name: 'Delivery', channel_type: 'delivery', status: 'planned' },
  { name: 'Takeaway', channel_type: 'takeaway', status: 'planned' },
  { name: 'Retail', channel_type: 'retail', status: 'planned' },
  { name: 'Event', channel_type: 'event', status: 'planned' },
  { name: 'Workshop', channel_type: 'workshop', status: 'planned' },
  { name: 'Online', channel_type: 'online', status: 'planned' },
];

export const UNIT_CONVERSIONS = [
  { from_unit: 'kg',     to_unit: 'g',      factor: 1000      },
  { from_unit: 'g',      to_unit: 'kg',     factor: 0.001     },
  { from_unit: 'L',      to_unit: 'ml',     factor: 1000      },
  { from_unit: 'ml',     to_unit: 'L',      factor: 0.001     },
  { from_unit: 'dozen',  to_unit: 'pieces', factor: 12        },
  { from_unit: 'pieces', to_unit: 'dozen',  factor: 0.08333   },
  { from_unit: 'oz',     to_unit: 'g',      factor: 28.3495   },
  { from_unit: 'g',      to_unit: 'oz',     factor: 0.035274  },
  { from_unit: 'lb',     to_unit: 'kg',     factor: 0.453592  },
  { from_unit: 'kg',     to_unit: 'lb',     factor: 2.20462   },
  { from_unit: 'lb',     to_unit: 'g',      factor: 453.592   },
  { from_unit: 'g',      to_unit: 'lb',     factor: 0.00220462 },
  { from_unit: 'oz',     to_unit: 'kg',     factor: 0.0283495 },
  { from_unit: 'kg',     to_unit: 'oz',     factor: 35.274    },
  { from_unit: 'tsp',    to_unit: 'ml',     factor: 5         },
  { from_unit: 'ml',     to_unit: 'tsp',    factor: 0.2       },
  { from_unit: 'tbsp',   to_unit: 'ml',     factor: 15        },
  { from_unit: 'ml',     to_unit: 'tbsp',   factor: 0.0667    },
  { from_unit: 'cup',    to_unit: 'ml',     factor: 240       },
  { from_unit: 'ml',     to_unit: 'cup',    factor: 0.00417   },
];

export const INGREDIENT_CATEGORIES = [
  { name: 'Dairy', sort_order: 1 },
  { name: 'Vegetables', sort_order: 2 },
  { name: 'Fruits', sort_order: 3 },
  { name: 'Herbs (fresh)', sort_order: 4 },
  { name: 'Spices (dried)', sort_order: 5 },
  { name: 'Flours & Starches', sort_order: 6 },
  { name: 'Sugars & Sweeteners', sort_order: 7 },
  { name: 'Leaveners', sort_order: 8 },
  { name: 'Nuts & Seeds', sort_order: 9 },
  { name: 'Oils & Fats', sort_order: 10 },
  { name: 'Proteins (meat)', sort_order: 11 },
  { name: 'Seafood', sort_order: 12 },
  { name: 'Eggs', sort_order: 13 },
  { name: 'Chocolates & Cocoa', sort_order: 14 },
  { name: 'Extracts & Essences', sort_order: 15 },
  { name: 'Grains & Cereals', sort_order: 16 },
  { name: 'Legumes & Pulses', sort_order: 17 },
  { name: 'Condiments & Sauces', sort_order: 18 },
  { name: 'Vinegars', sort_order: 19 },
  { name: 'Beverages', sort_order: 20 },
  { name: 'Baking Supplies', sort_order: 21 },
  { name: 'Frozen', sort_order: 22 },
  { name: 'Canned & Preserved', sort_order: 23 },
  { name: 'Packaging', sort_order: 24 },
  { name: 'Equipment', sort_order: 25 },
];
