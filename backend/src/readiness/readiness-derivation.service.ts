import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MeterMode,
  OrderStatus,
  ProductStatus,
  ProductType,
  RecipeStatus,
  UsageType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SettingsService,
  SETTING_DEFAULTS,
} from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import type {
  DerivedResult,
  ProcurementInput,
  QualityInput,
  SalesInput,
  StandardizationInput,
} from './derivation/derivation.types';
import {
  DERIVED_FORMULAS,
  HYBRID_PARTNER_CODES,
  clamp,
  procurement,
  quality,
  sales,
  standardization,
  type DerivedFormulaKey,
  type DerivedMeterCode,
  type HybridFormulaKey,
} from './derivation/derived-meters';
import { blendMeterValue } from './derivation/meter-value';

/** The `readiness` settings block — the knobs every formula reads. */
export type ReadinessSettings = typeof SETTING_DEFAULTS.readiness;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A formula key that is null or not in `DERIVED_FORMULAS` publishes this. */
const EMPTY_RESULT: DerivedResult = { value: 0, sample_size: 0, detail: {} };

/**
 * SPEC §4.3 — the Prisma shell around `readiness/derivation/**`.
 *
 * It gathers the plain snapshot each pure formula consumes, then publishes the
 * three value columns on `ReadinessMeter`. It is the **only** writer of
 * `task_value` / `derived_value` / `current_value` on a recompute path, so the
 * blend rule (`blendMeterValue`) can never be applied twice by two different
 * rules. Snapshot *writing* and the nightly job live in `readiness.cron.ts`.
 */
@Injectable()
export class ReadinessDerivationService {
  private readonly logger = new Logger(ReadinessDerivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
  ) {}

  /**
   * Recompute one meter by code. `task_driven` meters only re-publish their
   * `task_value`; `derived`/`hybrid` meters run their formula first.
   * Returns the published `current_value`.
   */
  async recomputeMeter(code: string): Promise<number> {
    const nodeId = await this.node.currentId();
    const meter = await this.prisma.readinessMeter.findUnique({
      where: { node_id_code: { node_id: nodeId, code } },
    });
    if (!meter)
      throw new NotFoundException(`Readiness meter ${code} not found`);

    const cfg = await this.settings.get('readiness');
    const since = new Date(Date.now() - cfg.trailing_days * DAY_MS);

    // The task-driven half is always re-derived from the active event ledger, so a
    // revoked TaskReadinessEvent is reflected even on a derived-only recompute.
    const taskAgg = await this.prisma.taskReadinessEvent.aggregate({
      where: { readiness_meter_id: meter.id, revoked_at: null },
      _sum: { value: true },
    });
    const taskValue = clamp(Number(taskAgg?._sum?.value ?? 0));

    let derivedValue: number | null = meter.derived_value;
    if (meter.mode === MeterMode.derived) {
      derivedValue = (
        await this.runFormula(meter.formula_key, nodeId, since, cfg)
      ).value;
    } else if (meter.mode === MeterMode.hybrid) {
      const partner = this.hybridPartnerCode(meter.formula_key);
      derivedValue = partner
        ? await this.readDerivedValue(nodeId, partner)
        : null;
    }

    const currentValue = blendMeterValue(meter.mode, taskValue, derivedValue);
    await this.prisma.readinessMeter.update({
      where: { id: meter.id },
      data: {
        task_value: taskValue,
        derived_value: derivedValue,
        current_value: currentValue,
        last_computed_at: new Date(),
      },
    });
    return currentValue;
  }

  /**
   * Recompute every meter of the node — used by the nightly job and the admin
   * button. Ordered `derived → hybrid → task_driven` so a hybrid always blends
   * the derived value produced in the same pass. One mis-seeded meter is logged
   * and skipped rather than aborting the whole run.
   */
  async recomputeAll(): Promise<{ code: string; value: number }[]> {
    const nodeId = await this.node.currentId();
    const meters = await this.prisma.readinessMeter.findMany({
      where: { node_id: nodeId },
      select: { code: true, mode: true },
      orderBy: { code: 'asc' },
    });

    const passes: MeterMode[] = [
      MeterMode.derived,
      MeterMode.hybrid,
      MeterMode.task_driven,
    ];
    const ordered = passes.flatMap((mode) =>
      meters.filter((m) => m.mode === mode),
    );

    const results: { code: string; value: number }[] = [];
    for (const meter of ordered) {
      try {
        results.push({
          code: meter.code,
          value: await this.recomputeMeter(meter.code),
        });
      } catch (error) {
        this.logger.error(
          `Readiness recompute failed for ${meter.code}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return results;
  }

  /**
   * Recompute `code` and then every `hybrid` meter that blends it — so a
   * `STANDARDIZATION` change moves `BACKEND` in the same pass.
   */
  async recomputeWithHybrids(code: string): Promise<void> {
    await this.recomputeMeter(code);

    const dependentKeys = (
      Object.keys(HYBRID_PARTNER_CODES) as HybridFormulaKey[]
    ).filter((key) => HYBRID_PARTNER_CODES[key] === code);
    if (dependentKeys.length === 0) return;

    const nodeId = await this.node.currentId();
    const hybrids = await this.prisma.readinessMeter.findMany({
      where: {
        node_id: nodeId,
        mode: MeterMode.hybrid,
        formula_key: { in: dependentKeys },
      },
      select: { code: true },
    });
    for (const hybrid of hybrids) {
      await this.recomputeMeter(hybrid.code);
    }
  }

  // ─── formula dispatch ──────────────────────────────────────────────────────

  /**
   * `formula_key` → gather + pure formula. An unknown or null key publishes 0
   * and logs a warning: a mis-seeded meter must not crash a recompute.
   */
  private async runFormula(
    formulaKey: string | null,
    nodeId: string,
    since: Date,
    cfg: ReadinessSettings,
  ): Promise<DerivedResult> {
    const target: DerivedMeterCode | undefined =
      formulaKey && formulaKey in DERIVED_FORMULAS
        ? DERIVED_FORMULAS[formulaKey as DerivedFormulaKey]
        : undefined;

    switch (target) {
      case 'STANDARDIZATION':
        return standardization(await this.gatherStandardization(nodeId));
      case 'PROCUREMENT':
        return procurement(await this.gatherProcurement(nodeId));
      case 'SALES':
        return sales(await this.gatherSales(nodeId, since, cfg));
      case 'QUALITY':
        return quality(await this.gatherQuality(nodeId, since, cfg));
      default:
        this.logger.warn(
          `Readiness formula_key "${formulaKey ?? 'null'}" is not registered — publishing 0`,
        );
        return { ...EMPTY_RESULT };
    }
  }

  /** A `hybrid` meter's `formula_key` names the derived meter it blends with. */
  private hybridPartnerCode(formulaKey: string | null): string | null {
    if (!formulaKey || !(formulaKey in HYBRID_PARTNER_CODES)) {
      if (formulaKey) {
        this.logger.warn(
          `Hybrid meter formula_key "${formulaKey}" has no derived partner — blending against null`,
        );
      }
      return null;
    }
    return HYBRID_PARTNER_CODES[formulaKey as HybridFormulaKey];
  }

  /** The partner meter's stored `derived_value`; null when it has never been computed. */
  private async readDerivedValue(
    nodeId: string,
    code: string,
  ): Promise<number | null> {
    const partner = await this.prisma.readinessMeter.findUnique({
      where: { node_id_code: { node_id: nodeId, code } },
      select: { derived_value: true },
    });
    return partner?.derived_value ?? null;
  }

  // ─── gatherers ─────────────────────────────────────────────────────────────

  /** Active sellable products with their recipe status and cost. */
  private async gatherStandardization(
    nodeId: string,
  ): Promise<StandardizationInput> {
    const products = await this.prisma.product.findMany({
      where: {
        node_id: nodeId,
        status: ProductStatus.active,
        type: { in: [ProductType.prepared_food, ProductType.packaged] },
      },
      select: { recipe: { select: { status: true, computed_cost: true } } },
    });
    return {
      products: products.map((p) => ({
        recipe_status: p.recipe?.status ?? null,
        computed_cost:
          p.recipe?.computed_cost != null
            ? Number(p.recipe.computed_cost)
            : null,
      })),
    };
  }

  /** Distinct recipe-input ingredients across approved recipes' BOMs. */
  private async gatherProcurement(nodeId: string): Promise<ProcurementInput> {
    const lines = await this.prisma.recipeLine.findMany({
      where: {
        ingredient_id: { not: null },
        recipe: { node_id: nodeId, status: RecipeStatus.approved },
        ingredient: { usage_type: UsageType.recipe_input },
      },
      select: { ingredient_id: true },
      distinct: ['ingredient_id'],
    });
    const ids = lines
      .map((l) => l.ingredient_id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return { ingredients: [] };

    const [ingredients, prices, stocks] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { id: { in: ids } },
        select: { id: true, min_stock_level: true },
      }),
      this.prisma.vendorPrice.groupBy({
        by: ['ingredient_id'],
        where: {
          ingredient_id: { in: ids },
          effective_date: { lte: new Date() },
        },
        _count: { id: true },
      }),
      this.prisma.ingredientStock.groupBy({
        by: ['ingredient_id'],
        where: { ingredient_id: { in: ids } },
        _sum: { current_quantity: true },
      }),
    ]);

    const priced = new Set(prices.map((p) => p.ingredient_id));
    // IngredientStock is per (ingredient, zone) — sum the zones before comparing.
    const stockBy = new Map(
      stocks.map((s) => [
        s.ingredient_id,
        Number(s._sum?.current_quantity ?? 0),
      ]),
    );
    return {
      ingredients: ingredients.map((i) => ({
        ingredient_id: i.id,
        has_active_vendor_price: priced.has(i.id),
        stock_on_hand: stockBy.get(i.id) ?? 0,
        min_stock_level: Number(i.min_stock_level),
      })),
    };
  }

  /**
   * Channels with >= 1 completed order in the trailing window, plus the total.
   * Decision 9 — "completed" spans the POS terminal states (`served`/`completed`)
   * and the marketplace one (`delivered`), or the marketplace channel would score 0.
   */
  private async gatherSales(
    nodeId: string,
    since: Date,
    cfg: ReadinessSettings,
  ): Promise<SalesInput> {
    const groups = await this.prisma.order.groupBy({
      by: ['channel'],
      where: {
        node_id: nodeId,
        created_at: { gte: since },
        status: {
          in: [
            OrderStatus.served,
            OrderStatus.delivered,
            OrderStatus.completed,
          ],
        },
      },
      _count: { id: true },
    });
    return {
      channels_with_orders: groups.length,
      completed_orders: groups.reduce(
        (total, g) => total + Number(g._count?.id ?? 0),
        0,
      ),
      points_per_channel: cfg.sales_points_per_channel,
      volume_threshold: cfg.sales_volume_threshold,
      volume_bonus: cfg.sales_volume_bonus,
    };
  }

  /**
   * Trailing waste cost against trailing COGS, plus the mean feedback rating.
   *
   * Decision 8 — COGS is `Σ quantity × recipe.computed_cost`, the same per-unit
   * convention `analytics.service.ts` already reports.
   * Decision 7 — `Feedback` carries no `node_id`, so the rating half is not
   * node-filtered; safe while v2 runs exactly one node.
   */
  private async gatherQuality(
    nodeId: string,
    since: Date,
    cfg: ReadinessSettings,
  ): Promise<QualityInput> {
    const [waste, items, ratings] = await Promise.all([
      this.prisma.wasteLog.aggregate({
        _sum: { cost_impact: true },
        where: { node_id: nodeId, created_at: { gte: since } },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: {
            node_id: nodeId,
            created_at: { gte: since },
            status: { notIn: [OrderStatus.cancelled, OrderStatus.refunded] },
          },
        },
        select: {
          quantity: true,
          product: { select: { recipe: { select: { computed_cost: true } } } },
        },
      }),
      this.prisma.feedback.aggregate({
        _avg: { rating: true },
        where: { created_at: { gte: since } },
      }),
    ]);

    const cogs = items.reduce((total, item) => {
      const cost = item.product?.recipe?.computed_cost;
      return cost == null
        ? total
        : total + Number(item.quantity) * Number(cost);
    }, 0);

    return {
      waste_cost: Number(waste?._sum?.cost_impact ?? 0),
      cogs,
      average_rating: ratings?._avg?.rating ?? null,
      waste_multiplier: cfg.quality_waste_multiplier,
    };
  }
}
