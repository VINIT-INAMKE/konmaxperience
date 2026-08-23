import 'reflect-metadata';
import {
  ApprovalMode,
  ApprovalScope,
  FulfilmentType,
  MediaKind,
  MeterMode,
  PreparationType,
  ProductType,
  StockMode,
  TaskDomain,
} from '@prisma/client';
import {
  ALL_ROLES,
  MODULE_ACCESS,
  resolveModuleRoleCodes,
} from '../../prisma/seed-data/module-access';
import { APPROVAL_POLICIES } from '../../prisma/seed-data/approval-policies';
import {
  INGREDIENT_CATEGORIES,
  READINESS_METERS,
} from '../../prisma/seed-data/reference';
import { ROLE_SEEDS } from '../../prisma/seed-data/roles';
import {
  SEED_SETTING_DEFAULTS,
  SEED_SETTING_KEYS,
} from '../../prisma/seed-data/settings';
import {
  DEMO_EVENTS,
  DEMO_INGREDIENTS,
  DEMO_PRODUCTS,
  DEMO_PRODUCT_CATEGORIES,
  DEMO_RECIPES,
} from '../../prisma/seed-data/demo-catalog';
import { SYSTEM_ACTOR } from '../../prisma/seed-data/system-actor';
import { RoleCode } from '../types/roles';
import { Permission } from '../types/permissions';
import { SETTING_DEFAULTS, SETTING_KEYS } from '../settings/settings.service';
import {
  SYSTEM_ROLE_CODE,
  SYSTEM_USER_EMAIL,
  SYSTEM_USER_ID,
  SYSTEM_USER_NAME,
  SYSTEM_USER_PASSWORD_HASH,
  SYSTEM_USER_STATUS,
} from '../common/constants/system-actor';

const ROLE_CODES = Object.values(RoleCode) as string[];

describe('seed-data: module access (SPEC §6.3)', () => {
  const approverRoleCodes = ROLE_SEEDS.filter((r) =>
    r.permissions.includes(Permission.APPROVE_EVIDENCE),
  ).map((r) => r.code as string);

  it('ALL_ROLES matches every role code seeded by roles.ts', () => {
    expect([...ALL_ROLES].sort()).toEqual(
      ROLE_SEEDS.map((r) => r.code as string).sort(),
    );
  });

  it('has a unique module_key per row', () => {
    const keys = MODULE_ACCESS.map((m) => m.module_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a unique sort_order per row', () => {
    const orders = MODULE_ACCESS.map((m) => m.sort_order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('only ever names real role codes', () => {
    for (const m of MODULE_ACCESS) {
      const resolved = resolveModuleRoleCodes(m, approverRoleCodes);
      expect(resolved.length).toBeGreaterThan(0);
      for (const code of resolved) {
        expect(ROLE_CODES).toContain(code);
      }
    }
  });

  it('gives every seeded role code at least one module', () => {
    const granted = new Set(
      MODULE_ACCESS.flatMap((m) =>
        resolveModuleRoleCodes(m, approverRoleCodes),
      ),
    );
    for (const code of ROLE_CODES) {
      expect(granted.has(code)).toBe(true);
    }
  });

  it('resolves APPROVERS to exactly the roles holding APPROVE_EVIDENCE', () => {
    const approvals = MODULE_ACCESS.find((m) => m.module_key === 'approvals');
    expect(approvals).toBeDefined();
    expect(
      resolveModuleRoleCodes(approvals!, approverRoleCodes).sort(),
    ).toEqual([...approverRoleCodes].sort());
  });

  it('gives every role the SPEC §6.2 navigation spine modules', () => {
    for (const key of [
      'mission_control',
      'my_tasks',
      'my_quests',
      'evidence',
      'decisions',
      'readiness',
      'team',
      'guide',
      'chat',
    ]) {
      const row = MODULE_ACCESS.find((m) => m.module_key === key);
      expect(row?.role_codes).toBe('ALL');
    }
  });

  it('restricts every admin module to FOUNDER_ADMIN and TECH_LEAD', () => {
    for (const key of [
      'imports',
      'users',
      'permissions',
      'delegations',
      'notices',
      'settings',
      'modules',
      'guide_editor',
      'zones',
      'channels',
    ]) {
      const row = MODULE_ACCESS.find((m) => m.module_key === key);
      expect(row).toBeDefined();
      expect(resolveModuleRoleCodes(row!, approverRoleCodes).sort()).toEqual(
        [RoleCode.FOUNDER_ADMIN, RoleCode.TECH_LEAD].sort(),
      );
    }
  });
});

describe('seed-data: approval policies (SPEC §4.4)', () => {
  it('names only real role codes', () => {
    for (const p of APPROVAL_POLICIES) {
      for (const code of p.required_role_codes) {
        expect(ROLE_CODES).toContain(code);
      }
    }
  });

  it('uses only real ApprovalScope / TaskDomain / ApprovalMode values', () => {
    for (const p of APPROVAL_POLICIES) {
      expect(Object.values(ApprovalScope)).toContain(p.scope);
      expect(Object.values(ApprovalMode)).toContain(p.mode);
      if (p.domain !== null) {
        expect(Object.values(TaskDomain)).toContain(p.domain);
      }
    }
  });

  it('has one row per (scope, domain) so the unique index holds', () => {
    const keys = APPROVAL_POLICIES.map((p) => `${p.scope}:${p.domain ?? '*'}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('declares exactly one default policy, and it is the null-domain fallback', () => {
    const defaults = APPROVAL_POLICIES.filter((p) => p.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].domain).toBeNull();
  });

  it('requires at least as many approvals as it names roles, in `all` mode', () => {
    for (const p of APPROVAL_POLICIES.filter((x) => x.mode === 'all')) {
      expect(p.min_approvals).toBe(p.required_role_codes.length);
    }
  });

  it('covers the SPEC §4.4 blueprint gates', () => {
    const gate = (scope: string, domain: string) =>
      APPROVAL_POLICIES.find((p) => p.scope === scope && p.domain === domain);
    expect(gate('recipe', 'food')?.required_role_codes).toEqual([
      RoleCode.BACKEND_LEAD,
      RoleCode.FRONTEND_LEAD,
    ]);
    expect(gate('pricing', 'bi')?.required_role_codes).toEqual([
      RoleCode.BI_LEAD,
      RoleCode.FRONTEND_LEAD,
    ]);
    expect(gate('vendor', 'procurement')?.required_role_codes).toEqual([
      RoleCode.PROCUREMENT_LEAD,
      RoleCode.BACKEND_LEAD,
    ]);
    expect(gate('experience', 'design')?.required_role_codes).toEqual([
      RoleCode.FRONTEND_LEAD,
      RoleCode.DESIGN_OUTREACH_LEAD,
    ]);
    expect(gate('tech', 'tech')?.required_role_codes).toEqual([
      RoleCode.TECH_LEAD,
      RoleCode.FOUNDER_ADMIN,
    ]);
    expect(gate('hiring', 'talent')?.required_role_codes).toEqual([
      RoleCode.TALENT_LEAD,
      RoleCode.FOUNDER_ADMIN,
    ]);
  });
});

describe('seed-data: readiness meters (SPEC §4.3)', () => {
  it('has a unique code per row', () => {
    const codes = READINESS_METERS.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses only real MeterMode values', () => {
    for (const meter of READINESS_METERS) {
      expect(Object.values(MeterMode)).toContain(meter.mode);
    }
  });

  it('gives every derived and hybrid meter a formula_key, and no other', () => {
    for (const meter of READINESS_METERS) {
      if (meter.mode === 'task_driven') {
        expect(meter.formula_key).toBeNull();
      } else {
        expect(typeof meter.formula_key).toBe('string');
        expect(meter.formula_key).not.toHaveLength(0);
      }
    }
  });

  it('declares the SPEC §4.3 derived and hybrid meters', () => {
    const byMode = (mode: string) =>
      READINESS_METERS.filter((m) => m.mode === mode)
        .map((m) => m.code)
        .sort();
    expect(byMode('derived')).toEqual(
      ['PROCUREMENT', 'QUALITY', 'SALES', 'STANDARDIZATION'].sort(),
    );
    expect(byMode('hybrid')).toEqual(['BACKEND', 'FRONTEND'].sort());
    expect(byMode('task_driven')).toEqual(
      [
        'ART_EXPERIENCE',
        'BI',
        'LIFESTYLE_EXPERIENCE',
        'TALENT',
        'TECH',
        'VILLA',
      ].sort(),
    );
  });
});

describe('seed-data: system settings', () => {
  it('mirrors SETTING_DEFAULTS exactly', () => {
    expect(SEED_SETTING_DEFAULTS).toEqual(SETTING_DEFAULTS);
  });

  it('mirrors SETTING_KEYS exactly, in the same order', () => {
    expect(SEED_SETTING_KEYS).toEqual(SETTING_KEYS);
  });

  it('holds real JSON values, never stringified ones', () => {
    expect(typeof SEED_SETTING_DEFAULTS.leaderboard_enabled).toBe('boolean');
    expect(typeof SEED_SETTING_DEFAULTS.maintenance_mode).toBe('boolean');
    expect(Array.isArray(SEED_SETTING_DEFAULTS.delivery_pincodes)).toBe(true);
    expect(typeof SEED_SETTING_DEFAULTS.xp_rules).toBe('object');
    expect(typeof SEED_SETTING_DEFAULTS.shipping).toBe('object');
    expect(typeof SEED_SETTING_DEFAULTS.loyalty).toBe('object');
  });

  it('mirrors the SPEC §4.3 readiness block exactly', () => {
    expect(SEED_SETTING_DEFAULTS.readiness).toEqual(SETTING_DEFAULTS.readiness);
  });
});

describe('seed-data: system actor (SPEC §4.2)', () => {
  it('seeds the fixed id the bridge writes evidence with', () => {
    expect(SYSTEM_ACTOR.user.id).toBe(SYSTEM_USER_ID);
    expect(SYSTEM_ACTOR.user.email).toBe(SYSTEM_USER_EMAIL);
    expect(SYSTEM_ACTOR.user.name).toBe(SYSTEM_USER_NAME);
    expect(SYSTEM_ACTOR.role.code).toBe(SYSTEM_ROLE_CODE);
  });

  it('gives the SYSTEM role zero permissions', () => {
    // A permission creeping onto the bridge account is exactly the failure
    // this catches: it holds an identity, never authority.
    expect(SYSTEM_ACTOR.role.permissions).toHaveLength(0);
  });

  it('cannot log in — inactive status and a hash bcrypt can never match', () => {
    expect(SYSTEM_ACTOR.user.status).toBe(SYSTEM_USER_STATUS);
    expect(SYSTEM_ACTOR.user.status).not.toBe('active');
    expect(SYSTEM_ACTOR.user.password_hash).toBe(SYSTEM_USER_PASSWORD_HASH);
    expect(SYSTEM_ACTOR.user.password_hash).not.toMatch(/^\$2[aby]\$/);
  });

  it('is kept out of ROLE_SEEDS, which drives demo logins', () => {
    expect(ROLE_SEEDS.map((r) => r.code as string)).not.toContain(
      SYSTEM_ROLE_CODE,
    );
    expect(ROLE_CODES).not.toContain(SYSTEM_ROLE_CODE);
  });

  it('is never granted a module, so no navigation entry resolves to it', () => {
    const approvers = ROLE_SEEDS.filter((r) =>
      r.permissions.includes(Permission.APPROVE_EVIDENCE),
    ).map((r) => r.code as string);
    const granted = new Set(
      MODULE_ACCESS.flatMap((m) => resolveModuleRoleCodes(m, approvers)),
    );
    expect(granted.has(SYSTEM_ROLE_CODE)).toBe(false);
  });
});

describe('seed-data: demo catalog', () => {
  const recipeNames = new Set(DEMO_RECIPES.map((r) => r.name));
  const eventTitles = new Set(DEMO_EVENTS.map((e) => e.title));
  const categorySlugs = new Set(DEMO_PRODUCT_CATEGORIES.map((c) => c.slug));
  const ingredientNames = new Set(DEMO_INGREDIENTS.map((i) => i.name));

  it('seeds twelve products spanning all four ProductTypes', () => {
    expect(DEMO_PRODUCTS).toHaveLength(12);
    expect(new Set(DEMO_PRODUCTS.map((p) => p.type))).toEqual(
      new Set(Object.values(ProductType)),
    );
  });

  it('gives every ingredient a category seeded by seed-reference', () => {
    const known = new Set(INGREDIENT_CATEGORIES.map((c) => c.name));
    for (const ing of DEMO_INGREDIENTS) {
      expect(known.has(ing.category)).toBe(true);
      expect(ing.min_stock_level).toBeGreaterThan(0);
    }
    expect(new Set(ingredientNames).size).toBe(DEMO_INGREDIENTS.length);
  });

  it('gives every recipe a real preparation_type, a positive cost and real BOM lines', () => {
    expect(DEMO_RECIPES).toHaveLength(8);
    for (const recipe of DEMO_RECIPES) {
      expect(Object.values(PreparationType)).toContain(recipe.preparation_type);
      expect(recipe.computed_cost).toBeGreaterThan(0);
      expect(recipe.yield_qty).toBeGreaterThan(0);
      expect(recipe.lines.length).toBeGreaterThan(0);
      for (const line of recipe.lines) {
        expect(ingredientNames.has(line.ingredient)).toBe(true);
        expect(line.quantity).toBeGreaterThan(0);
      }
    }
  });

  it('uses every ingredient in at least one recipe', () => {
    const used = new Set(
      DEMO_RECIPES.flatMap((r) => r.lines.map((l) => l.ingredient)),
    );
    for (const name of ingredientNames) {
      expect(used.has(name)).toBe(true);
    }
  });

  it('gives every product a unique kebab-case slug and a real category', () => {
    const slugs = DEMO_PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const product of DEMO_PRODUCTS) {
      expect(product.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(categorySlugs.has(product.category_slug)).toBe(true);
    }
  });

  it('gives every product category a unique kebab-case slug and real product types', () => {
    const slugs = DEMO_PRODUCT_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const category of DEMO_PRODUCT_CATEGORIES) {
      expect(category.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(category.product_types.length).toBeGreaterThan(0);
      for (const type of category.product_types) {
        expect(Object.values(ProductType)).toContain(type);
      }
    }
  });

  it('routes each product type to the right recipe/event linkage', () => {
    for (const product of DEMO_PRODUCTS) {
      if (product.type === 'prepared_food' || product.type === 'packaged') {
        expect(product.recipe).not.toBeNull();
        expect(recipeNames.has(product.recipe!)).toBe(true);
        expect(product.event).toBeNull();
        expect(product.stock_mode).toBe(StockMode.derived_from_recipe);
      } else if (product.type === 'experience') {
        expect(product.recipe).toBeNull();
        expect(product.event).not.toBeNull();
        expect(eventTitles.has(product.event!)).toBe(true);
        expect(product.fulfilment).toBe(FulfilmentType.booking);
        expect(product.stock_mode).toBe(StockMode.capacity);
      } else {
        expect(product.recipe).toBeNull();
        expect(product.event).toBeNull();
        expect(product.stock_mode).toBe(StockMode.tracked);
      }
    }
  });

  it('applies 5% tax to prepared food and 12% to packaged and merchandise', () => {
    for (const product of DEMO_PRODUCTS) {
      if (product.type === 'prepared_food') expect(product.tax_rate).toBe(5);
      if (product.type === 'packaged' || product.type === 'merchandise') {
        expect(product.tax_rate).toBe(12);
      }
      expect(product.base_price).toBeGreaterThan(0);
    }
  });

  it('sets weight_grams on every shipped product and on no other', () => {
    for (const product of DEMO_PRODUCTS) {
      if (product.fulfilment === FulfilmentType.shipped) {
        expect(product.weight_grams).toBeGreaterThan(0);
      } else {
        expect(product.weight_grams).toBeNull();
      }
    }
  });

  it('gives every product one image and exactly one default variant', () => {
    const skus = DEMO_PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
    for (const product of DEMO_PRODUCTS) {
      expect(product.media_kind).toBe(MediaKind.image);
      expect(product.media_alt.length).toBeGreaterThan(0);
      expect(product.variants.length).toBeGreaterThan(0);
      expect(product.variants.filter((v) => v.is_default)).toHaveLength(1);
      for (const variant of product.variants) {
        expect(variant.price_delta).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('stocks every tracked variant and leaves the rest at zero', () => {
    for (const product of DEMO_PRODUCTS) {
      for (const variant of product.variants) {
        if (product.stock_mode === StockMode.tracked) {
          expect(variant.stock_on_hand).toBeGreaterThan(0);
        } else {
          expect(variant.stock_on_hand).toBe(0);
        }
      }
    }
  });

  it('gives every event a future date, capacity and price', () => {
    for (const event of DEMO_EVENTS) {
      expect(event.days_from_now).toBeGreaterThan(0);
      expect(event.capacity).toBeGreaterThan(0);
      expect(event.price).toBeGreaterThan(0);
    }
  });
});
