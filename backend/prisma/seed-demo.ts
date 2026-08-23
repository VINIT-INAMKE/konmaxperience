import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ROLE_SEEDS } from './seed-data/roles';
import { assertDemoSeedAllowed, generatePassword } from './seed-utils';
import { RoleCode } from '../src/types/roles';
import { DEFAULT_NODE_ID } from '../src/node/node.constants';
import {
  DEMO_EVENTS,
  DEMO_INGREDIENTS,
  DEMO_PRODUCTS,
  DEMO_PRODUCT_CATEGORIES,
  DEMO_RECIPES,
  demoMediaUrl,
  demoSearchText,
} from './seed-data/demo-catalog';

type Tx = Prisma.TransactionClient;

const BCRYPT_ROUNDS = 12;

/** The demo catalog hangs off the food brand seeded by `seed-reference.ts`. */
const DEMO_BRAND_NAME = 'Konma Food';

/**
 * Demo user seed — refuses to run when NODE_ENV=production unless
 * SEED_DEMO_FORCE=true. Passwords are random and printed once, never stored
 * in plaintext and never checked into the repo.
 */
export async function seedDemo(prisma: PrismaClient): Promise<void> {
  assertDemoSeedAllowed(process.env);
  console.log('[seed:demo] start');

  const issued: Array<{ email: string; role: string; password: string }> = [];

  for (const seed of ROLE_SEEDS) {
    const role = await prisma.role.findUnique({
      where: { code: seed.code },
      select: { id: true },
    });
    if (!role) {
      throw new Error(
        `[seed:demo] role ${seed.code} missing — run "npm run seed:reference" first`,
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: seed.userEmail },
      select: { id: true },
    });
    if (existing) {
      // Never reset an existing user's password on re-run.
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: seed.userName,
          role_id: role.id,
          function: seed.functionDomain,
        },
      });
      continue;
    }

    const password = generatePassword();
    await prisma.user.create({
      data: {
        name: seed.userName,
        email: seed.userEmail,
        password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role_id: role.id,
        function: seed.functionDomain,
        status: 'active',
      },
    });
    issued.push({ email: seed.userEmail, role: seed.code, password });
  }

  if (issued.length === 0) {
    console.log(
      '[seed:demo] all demo users already exist — no passwords issued',
    );
  } else {
    console.log(
      '[seed:demo] NEW demo credentials (shown once, never stored in plaintext):',
    );
    for (const row of issued) {
      console.log(
        `  ${row.role.padEnd(22)} ${row.email.padEnd(28)} ${row.password}`,
      );
    }
  }

  // Catalog last, and only after the credentials are on screen: a generated
  // password exists nowhere else, so a catalog failure must never swallow it.
  await seedDemoCatalog(prisma);
}

/**
 * Demo catalog — ingredients → recipes → events → categories → products →
 * variants → media, all in one transaction and all idempotent: rows are matched
 * on their natural key (name/title, `node_id_slug`, `sku`), and the child
 * collections that have no natural key (recipe lines, product media) are
 * replaced wholesale per parent.
 */
export async function seedDemoCatalog(prisma: PrismaClient): Promise<void> {
  assertDemoSeedAllowed(process.env);
  console.log('[seed:demo] catalog start');

  const founderEmail = ROLE_SEEDS.find(
    (r) => r.code === RoleCode.FOUNDER_ADMIN,
  )!.userEmail;
  const creator = await prisma.user.findUnique({
    where: { email: founderEmail },
    select: { id: true },
  });
  if (!creator) {
    throw new Error(
      `[seed:demo] user ${founderEmail} missing — the demo user loop must run first`,
    );
  }

  const brand = await prisma.brand.findFirst({
    where: { node_id: DEFAULT_NODE_ID, name: DEMO_BRAND_NAME },
    select: { id: true },
  });
  if (!brand) {
    throw new Error(
      `[seed:demo] brand "${DEMO_BRAND_NAME}" missing — run "npm run seed:reference" first`,
    );
  }

  await prisma.$transaction(
    async (tx: Tx) => {
      const ingredientIds = await seedDemoIngredients(tx);
      const recipeIds = await seedDemoRecipes(tx, ingredientIds, creator.id);
      const eventIds = await seedDemoEvents(tx);
      const categoryIds = await seedDemoCategories(tx, brand.id);
      await seedDemoProducts(
        tx,
        { brandId: brand.id, userId: creator.id },
        { recipeIds, eventIds, categoryIds },
      );
    },
    { timeout: 60000 },
  );

  const variantCount = DEMO_PRODUCTS.reduce((n, p) => n + p.variants.length, 0);
  console.log(
    `[seed:demo] catalog done — ${DEMO_INGREDIENTS.length} ingredients, ` +
      `${DEMO_RECIPES.length} recipes, ${DEMO_EVENTS.length} events, ` +
      `${DEMO_PRODUCT_CATEGORIES.length} product categories, ` +
      `${DEMO_PRODUCTS.length} products, ${variantCount} variants, ` +
      `${DEMO_PRODUCTS.length} media`,
  );
}

/** `Ingredient` has no unique on `name`, so match-then-write rather than upsert. */
async function seedDemoIngredients(tx: Tx): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const ing of DEMO_INGREDIENTS) {
    const category = await tx.ingredientCategory.findUnique({
      where: { name: ing.category },
      select: { id: true },
    });
    if (!category) {
      throw new Error(
        `[seed:demo] ingredient category "${ing.category}" missing — run "npm run seed:reference" first`,
      );
    }
    const data = {
      category_id: category.id,
      base_unit: ing.base_unit,
      min_stock_level: ing.min_stock_level,
      usage_type: 'recipe_input' as const,
    };
    const existing = await tx.ingredient.findFirst({
      where: { node_id: DEFAULT_NODE_ID, name: ing.name },
      select: { id: true },
    });
    const row = existing
      ? await tx.ingredient.update({ where: { id: existing.id }, data })
      : await tx.ingredient.create({
          data: { node_id: DEFAULT_NODE_ID, name: ing.name, ...data },
        });
    ids.set(ing.name, row.id);
  }
  return ids;
}

/** `Recipe` has no unique on `name`; BOM lines have no natural key and are replaced. */
async function seedDemoRecipes(
  tx: Tx,
  ingredientIds: Map<string, string>,
  userId: string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const recipe of DEMO_RECIPES) {
    const data = {
      description: recipe.description,
      yield_qty: recipe.yield_qty,
      yield_unit: recipe.yield_unit,
      portion_size: recipe.portion_size,
      shelf_life_hours: recipe.shelf_life_hours,
      computed_cost: recipe.computed_cost,
      preparation_type: recipe.preparation_type,
      // Every demo recipe ships approved so `STANDARDIZATION` readiness and the
      // "only approved recipes can be sold" catalog rule are both meaningful.
      status: 'approved' as const,
    };
    const existing = await tx.recipe.findFirst({
      where: { node_id: DEFAULT_NODE_ID, name: recipe.name },
      select: { id: true },
    });
    const row = existing
      ? await tx.recipe.update({ where: { id: existing.id }, data })
      : await tx.recipe.create({
          data: {
            node_id: DEFAULT_NODE_ID,
            name: recipe.name,
            created_by: userId,
            ...data,
          },
        });

    await tx.recipeLine.deleteMany({ where: { recipe_id: row.id } });
    await tx.recipeLine.createMany({
      data: recipe.lines.map((line, i) => {
        const ingredient_id = ingredientIds.get(line.ingredient);
        if (!ingredient_id) {
          throw new Error(
            `[seed:demo] recipe "${recipe.name}" references unknown ingredient "${line.ingredient}"`,
          );
        }
        return {
          recipe_id: row.id,
          input_type: 'ingredient',
          ingredient_id,
          quantity: line.quantity,
          unit: line.unit,
          sort_order: i,
        };
      }),
    });
    ids.set(recipe.name, row.id);
  }
  return ids;
}

/** `Event` has no unique on `title`, so match-then-write rather than upsert. */
async function seedDemoEvents(tx: Tx): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const now = Date.now();
  for (const event of DEMO_EVENTS) {
    const data = {
      event_type: event.event_type,
      date: new Date(now + event.days_from_now * 24 * 60 * 60 * 1000),
      capacity: event.capacity,
      price: event.price,
      description: event.description,
    };
    const existing = await tx.event.findFirst({
      where: { node_id: DEFAULT_NODE_ID, title: event.title },
      select: { id: true },
    });
    const row = existing
      ? await tx.event.update({ where: { id: existing.id }, data })
      : await tx.event.create({
          data: {
            node_id: DEFAULT_NODE_ID,
            title: event.title,
            status: 'upcoming',
            ...data,
          },
        });
    ids.set(event.title, row.id);
  }
  return ids;
}

async function seedDemoCategories(
  tx: Tx,
  brandId: string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const category of DEMO_PRODUCT_CATEGORIES) {
    const data = {
      brand_id: brandId,
      name: category.name,
      sort_order: category.sort_order,
      product_types: category.product_types,
      status: 'active' as const,
    };
    const row = await tx.productCategory.upsert({
      where: {
        node_id_slug: { node_id: DEFAULT_NODE_ID, slug: category.slug },
      },
      update: data,
      create: { node_id: DEFAULT_NODE_ID, slug: category.slug, ...data },
    });
    ids.set(category.slug, row.id);
  }
  return ids;
}

async function seedDemoProducts(
  tx: Tx,
  owner: { brandId: string; userId: string },
  refs: {
    recipeIds: Map<string, string>;
    eventIds: Map<string, string>;
    categoryIds: Map<string, string>;
  },
): Promise<void> {
  const categoryNames = new Map(
    DEMO_PRODUCT_CATEGORIES.map((c) => [c.slug, c.name]),
  );

  for (const product of DEMO_PRODUCTS) {
    const category_id = refs.categoryIds.get(product.category_slug);
    if (!category_id) {
      throw new Error(
        `[seed:demo] product "${product.name}" references unknown category "${product.category_slug}"`,
      );
    }
    const recipe_id = product.recipe
      ? (refs.recipeIds.get(product.recipe) ?? null)
      : null;
    if (product.recipe && !recipe_id) {
      throw new Error(
        `[seed:demo] product "${product.name}" references unknown recipe "${product.recipe}"`,
      );
    }
    const event_id = product.event
      ? (refs.eventIds.get(product.event) ?? null)
      : null;
    if (product.event && !event_id) {
      throw new Error(
        `[seed:demo] product "${product.name}" references unknown event "${product.event}"`,
      );
    }

    const data = {
      brand_id: owner.brandId,
      category_id,
      type: product.type,
      name: product.name,
      description: product.description,
      story: product.story,
      base_price: product.base_price,
      tax_rate: product.tax_rate,
      hsn_code: product.hsn_code,
      fulfilment: product.fulfilment,
      stock_mode: product.stock_mode,
      recipe_id,
      event_id,
      weight_grams: product.weight_grams,
      shelf_life_days: product.shelf_life_days,
      is_featured: product.is_featured,
      status: 'active' as const,
      search_text: demoSearchText(
        product,
        categoryNames.get(product.category_slug) ?? '',
        DEMO_BRAND_NAME,
      ),
      updated_by: owner.userId,
    };

    const row = await tx.product.upsert({
      where: { node_id_slug: { node_id: DEFAULT_NODE_ID, slug: product.slug } },
      update: data,
      create: {
        node_id: DEFAULT_NODE_ID,
        slug: product.slug,
        created_by: owner.userId,
        ...data,
      },
    });

    for (const variant of product.variants) {
      const variantData = {
        product_id: row.id,
        name: variant.name,
        price_delta: variant.price_delta,
        stock_on_hand: variant.stock_on_hand,
        low_stock_threshold: variant.low_stock_threshold,
        is_default: variant.is_default,
        status: 'active' as const,
      };
      await tx.productVariant.upsert({
        where: { sku: variant.sku },
        update: variantData,
        create: { sku: variant.sku, ...variantData },
      });
    }

    // `ProductMedia` has no natural key — replace the product's media wholesale.
    await tx.productMedia.deleteMany({ where: { product_id: row.id } });
    await tx.productMedia.create({
      data: {
        product_id: row.id,
        url: demoMediaUrl(product.slug),
        alt: product.media_alt,
        kind: product.media_kind,
        sort_order: 0,
      },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDemo(prisma)
    .catch((e) => {
      console.error('[seed:demo] failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
