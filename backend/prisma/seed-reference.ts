import { PrismaClient, Prisma } from '@prisma/client';
import { ROLE_SEEDS } from './seed-data/roles';
import {
  READINESS_METERS,
  ZONES,
  BRANDS,
  CHANNELS,
  UNIT_CONVERSIONS,
  INGREDIENT_CATEGORIES,
} from './seed-data/reference';
import {
  MODULE_ACCESS,
  resolveModuleRoleCodes,
} from './seed-data/module-access';
import { APPROVAL_POLICIES } from './seed-data/approval-policies';
import { SYSTEM_ACTOR } from './seed-data/system-actor';
import { SEED_SETTING_DEFAULTS, SEED_SETTING_KEYS } from './seed-data/settings';
import { guideSections, computeReadTime } from './seed-data/guide-content';
import { Permission } from '../src/types/permissions';
import {
  DEFAULT_NODE_ID,
  DEFAULT_NODE_CODE,
  DEFAULT_NODE_NAME,
  DEFAULT_NODE_TIMEZONE,
  DEFAULT_NODE_CURRENCY,
} from '../src/node/node.constants';

type Tx = Prisma.TransactionClient;

/**
 * Reference data seed — idempotent and production-safe.
 * Every write is an upsert or a find-then-update; nothing is ever deleted, and
 * no user accounts or passwords are created here (see seed-demo.ts).
 */
export async function seedReference(prisma: PrismaClient): Promise<void> {
  console.log('[seed:reference] start');

  await prisma.$transaction(
    async (tx: Tx) => {
      // The single Node must exist before anything else — every aggregate's
      // `node_id` @default points at it. `status` is never reset on re-run.
      const node = await tx.node.upsert({
        where: { id: DEFAULT_NODE_ID },
        update: {
          name: DEFAULT_NODE_NAME,
          timezone: DEFAULT_NODE_TIMEZONE,
          currency: DEFAULT_NODE_CURRENCY,
        },
        create: {
          id: DEFAULT_NODE_ID,
          code: DEFAULT_NODE_CODE,
          name: DEFAULT_NODE_NAME,
          timezone: DEFAULT_NODE_TIMEZONE,
          currency: DEFAULT_NODE_CURRENCY,
          status: 'active',
        },
      });

      for (const seed of ROLE_SEEDS) {
        const data = {
          name: seed.name,
          description: seed.description,
          permissions: seed.permissions,
        };
        await tx.role.upsert({
          where: { code: seed.code },
          update: data,
          create: { code: seed.code, ...data },
        });
      }

      // SPEC §4.2 — the bridge's identity. Upserted, never reset. Kept out of
      // ROLE_SEEDS on purpose: that list drives demo *logins* in seed-demo.ts,
      // and this account must never be one. No password is generated here and
      // nothing is deleted, so the block is production-safe.
      const systemRole = await tx.role.upsert({
        where: { code: SYSTEM_ACTOR.role.code },
        update: {
          name: SYSTEM_ACTOR.role.name,
          description: SYSTEM_ACTOR.role.description,
          permissions: [...SYSTEM_ACTOR.role.permissions],
        },
        create: {
          code: SYSTEM_ACTOR.role.code,
          name: SYSTEM_ACTOR.role.name,
          description: SYSTEM_ACTOR.role.description,
          permissions: [...SYSTEM_ACTOR.role.permissions],
        },
      });
      await tx.user.upsert({
        where: { id: SYSTEM_ACTOR.user.id },
        // `email` and `password_hash` are never re-written: rotating them on a
        // re-run would be the only way this account could become usable.
        update: {
          name: SYSTEM_ACTOR.user.name,
          status: SYSTEM_ACTOR.user.status,
          role_id: systemRole.id,
        },
        create: { ...SYSTEM_ACTOR.user, role_id: systemRole.id },
      });

      // SPEC §6.3 — ModuleAccess is global (no node_id). `APPROVERS` resolves to
      // every role that can approve evidence.
      const approverRoleCodes = ROLE_SEEDS.filter((r) =>
        r.permissions.includes(Permission.APPROVE_EVIDENCE),
      ).map((r) => r.code as string);

      for (const m of MODULE_ACCESS) {
        const role_codes = resolveModuleRoleCodes(m, approverRoleCodes);
        await tx.moduleAccess.upsert({
          where: { module_key: m.module_key },
          // `enabled` is operator-controlled at /admin/modules — never reset it.
          update: { role_codes, sort_order: m.sort_order },
          create: {
            module_key: m.module_key,
            role_codes,
            sort_order: m.sort_order,
            enabled: true,
          },
        });
      }

      // SPEC §4.3 — mode/formula_key drive derived and hybrid readiness.
      for (const meter of READINESS_METERS) {
        const data = {
          name: meter.name,
          description: meter.description,
          mode: meter.mode,
          formula_key: meter.formula_key,
        };
        await tx.readinessMeter.upsert({
          where: { node_id_code: { node_id: node.id, code: meter.code } },
          update: data,
          create: { node_id: node.id, code: meter.code, ...data },
        });
      }

      // SPEC §4.4 — blueprint approval gates.
      for (const p of APPROVAL_POLICIES) {
        const data = {
          required_role_codes: p.required_role_codes,
          min_approvals: p.min_approvals,
          mode: p.mode,
          is_default: p.is_default,
        };
        // `@@unique([node_id, scope, domain])` cannot key an upsert here: Prisma
        // types the compound-unique input's `domain` as non-nullable, and
        // Postgres treats NULLs as distinct, so the `domain: null` fallback row
        // would never dedupe. Match-then-write keeps every row idempotent.
        const existing = await tx.approvalPolicy.findFirst({
          where: { node_id: node.id, scope: p.scope, domain: p.domain },
          select: { id: true },
        });
        if (existing) {
          await tx.approvalPolicy.update({ where: { id: existing.id }, data });
        } else {
          await tx.approvalPolicy.create({
            data: {
              node_id: node.id,
              scope: p.scope,
              domain: p.domain,
              ...data,
            },
          });
        }
      }

      // Zone/Brand/Channel have no unique on name (schema) — match by name, never reset status.
      let mainKitchenId: string | null = null;
      for (const zone of ZONES) {
        const existing = await tx.zone.findFirst({
          where: { name: zone.name },
          select: { id: true },
        });
        let id: string;
        if (existing) {
          await tx.zone.update({
            where: { id: existing.id },
            data: { zone_type: zone.zone_type },
          });
          id = existing.id;
        } else {
          id = (
            await tx.zone.create({
              data: {
                name: zone.name,
                zone_type: zone.zone_type,
                status: 'planned',
              },
            })
          ).id;
        }
        if (zone.name === 'Main Kitchen') mainKitchenId = id;
      }

      for (const brand of BRANDS) {
        const existing = await tx.brand.findFirst({
          where: { name: brand.name },
          select: { id: true },
        });
        if (existing) {
          await tx.brand.update({
            where: { id: existing.id },
            data: { brand_type: brand.brand_type },
          });
        } else {
          await tx.brand.create({ data: brand });
        }
      }

      for (const channel of CHANNELS) {
        const existing = await tx.channel.findFirst({
          where: { name: channel.name },
          select: { id: true },
        });
        if (existing) {
          await tx.channel.update({
            where: { id: existing.id },
            data: { channel_type: channel.channel_type },
          });
        } else {
          await tx.channel.create({ data: channel });
        }
      }

      for (const uc of UNIT_CONVERSIONS) {
        await tx.unitConversion.upsert({
          where: {
            from_unit_to_unit: { from_unit: uc.from_unit, to_unit: uc.to_unit },
          },
          update: { factor: uc.factor },
          create: uc,
        });
      }

      for (const cat of INGREDIENT_CATEGORIES) {
        await tx.ingredientCategory.upsert({
          where: { name: cat.name },
          update: { sort_order: cat.sort_order },
          create: { ...cat, is_default: true },
        });
      }

      // SystemSetting.value is Json (SPEC §3.1) — seed every allow-listed key at
      // its real JSON default (boolean/string/array/object), never stringified.
      for (const key of SEED_SETTING_KEYS) {
        const isZoneKey = key === 'marketplace_fulfilment_zone_id';
        const raw =
          isZoneKey && mainKitchenId
            ? mainKitchenId
            : SEED_SETTING_DEFAULTS[key];
        const value: Prisma.SystemSettingCreateInput['value'] =
          raw === null ? Prisma.JsonNull : (raw as Prisma.InputJsonValue);
        await tx.systemSetting.upsert({
          where: { key },
          // Operator-edited settings are never clobbered; the marketplace zone
          // is the one derived value the seed keeps pointing at Main Kitchen.
          update: isZoneKey && mainKitchenId ? { value } : {},
          create: { key, value },
        });
      }

      for (const section of guideSections) {
        const { pages, ...sectionData } = section;
        const saved = await tx.guideSection.upsert({
          where: { slug: sectionData.slug },
          update: sectionData,
          create: sectionData,
        });
        for (const page of pages) {
          const pageData = {
            ...page,
            estimated_read_time: computeReadTime(page.content),
          };
          await tx.guidePage.upsert({
            where: {
              section_id_slug: { section_id: saved.id, slug: page.slug },
            },
            update: pageData,
            create: { ...pageData, section_id: saved.id },
          });
        }
      }
    },
    { timeout: 60000 },
  );

  console.log(
    `[seed:reference] done — 1 node, ${ROLE_SEEDS.length} roles, ` +
      `${MODULE_ACCESS.length} modules, ${READINESS_METERS.length} meters, ` +
      `${APPROVAL_POLICIES.length} approval policies, ${ZONES.length} zones, ` +
      `${BRANDS.length} brands, ${CHANNELS.length} channels, ` +
      `${UNIT_CONVERSIONS.length} unit conversions, ${INGREDIENT_CATEGORIES.length} categories, ` +
      `${SEED_SETTING_KEYS.length} settings, ${guideSections.length} guide sections, ` +
      `1 system actor`,
  );
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedReference(prisma)
    .catch((e) => {
      console.error('[seed:reference] failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
