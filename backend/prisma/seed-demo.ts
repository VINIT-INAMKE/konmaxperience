import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ROLE_SEEDS } from './seed-data/roles';
import { assertDemoSeedAllowed, generatePassword } from './seed-utils';

const BCRYPT_ROUNDS = 12;

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
    console.log('[seed:demo] all demo users already exist — no passwords issued');
    return;
  }
  console.log(
    '[seed:demo] NEW demo credentials (shown once, never stored in plaintext):',
  );
  for (const row of issued) {
    console.log(
      `  ${row.role.padEnd(22)} ${row.email.padEnd(28)} ${row.password}`,
    );
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
