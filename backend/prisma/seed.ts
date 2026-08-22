// `prisma db seed` entrypoint: reference data always, demo users only where allowed.
import { PrismaClient } from '@prisma/client';
import { seedReference } from './seed-reference';
import { seedDemo } from './seed-demo';
import { isDemoSeedAllowed } from './seed-utils';

const prisma = new PrismaClient();

async function main() {
  await seedReference(prisma);
  if (isDemoSeedAllowed(process.env)) {
    await seedDemo(prisma);
  } else {
    console.log(
      '[seed] NODE_ENV=production — skipping demo users (set SEED_DEMO_FORCE=true to force)',
    );
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
