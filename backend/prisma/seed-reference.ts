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
import { guideSections, computeReadTime } from './seed-data/guide-content';
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
      // `node_id` @default points at it (full seed rewrite lands in Task 14).
      await tx.node.upsert({
        where: { id: DEFAULT_NODE_ID },
        update: {},
        create: {
          id: DEFAULT_NODE_ID,
          code: DEFAULT_NODE_CODE,
          name: DEFAULT_NODE_NAME,
          timezone: DEFAULT_NODE_TIMEZONE,
          currency: DEFAULT_NODE_CURRENCY,
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

      for (const meter of READINESS_METERS) {
        const data = { name: meter.name, description: meter.description };
        await tx.readinessMeter.upsert({
          where: {
            node_id_code: { node_id: DEFAULT_NODE_ID, code: meter.code },
          },
          update: data,
          create: { node_id: DEFAULT_NODE_ID, code: meter.code, ...data },
        });
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

      await tx.systemSetting.upsert({
        where: { key: 'leaderboard_enabled' },
        update: {},
        create: { key: 'leaderboard_enabled', value: 'true' },
      });
      if (mainKitchenId) {
        await tx.systemSetting.upsert({
          where: { key: 'marketplace_fulfilment_zone_id' },
          update: { value: mainKitchenId },
          create: {
            key: 'marketplace_fulfilment_zone_id',
            value: mainKitchenId,
          },
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
    `[seed:reference] done — ${ROLE_SEEDS.length} roles, ${READINESS_METERS.length} meters, ` +
      `${ZONES.length} zones, ${BRANDS.length} brands, ${CHANNELS.length} channels, ` +
      `${UNIT_CONVERSIONS.length} unit conversions, ${INGREDIENT_CATEGORIES.length} categories, ` +
      `${guideSections.length} guide sections`,
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
