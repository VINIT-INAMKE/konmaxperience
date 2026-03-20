import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RoleCode } from '../src/types/roles';
import { Permission } from '../src/types/permissions';

const prisma = new PrismaClient();

const TEMP_PASSWORD = 'KonmaTemp123!';
const BCRYPT_ROUNDS = 12;

interface RoleSeed {
  code: RoleCode;
  name: string;
  description: string;
  permissions: Permission[];
  functionDomain: string;
  userName: string;
  userEmail: string;
}

const ROLE_SEEDS: RoleSeed[] = [
  {
    code: RoleCode.FOUNDER_ADMIN,
    name: 'Founder/Admin',
    description: 'Strategy, mission control, escalations, overrides. Full system access.',
    permissions: [
      Permission.VIEW_ALL,
      Permission.CREATE_MISSION,
      Permission.CREATE_QUEST,
      Permission.CREATE_TASK,
      Permission.UPDATE_ANY_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.CREATE_DECISION,
      Permission.APPROVE_DECISION,
      Permission.MANAGE_RBAC,
      Permission.CREATE_ADHOC_TASK,
      Permission.MANAGE_SYSTEM,
    ],
    functionDomain: 'operations',
    userName: 'Aditee',
    userEmail: 'aditee@konmaxperience.com',
  },
  {
    code: RoleCode.FRONTEND_LEAD,
    name: 'Frontend Lead',
    description: 'Customer flow, service, beverage, space interaction, channels.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.CREATE_TASK,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'food',
    userName: 'Frontend Lead User',
    userEmail: 'frontend@konmaxperience.com',
  },
  {
    code: RoleCode.BACKEND_LEAD,
    name: 'Backend Lead',
    description: 'Food, production, R&D, standardization, quality.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.CREATE_TASK,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'food',
    userName: 'Backend Lead User',
    userEmail: 'backend@konmaxperience.com',
  },
  {
    code: RoleCode.BI_LEAD,
    name: 'BI Lead',
    description: 'Costing, pricing, KPIs, performance analytics.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.CREATE_TASK,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'bi',
    userName: 'BI Lead User',
    userEmail: 'bi@konmaxperience.com',
  },
  {
    code: RoleCode.PROCUREMENT_LEAD,
    name: 'Procurement Lead',
    description: 'Vendors, sourcing, inventory management.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.CREATE_TASK,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
    ],
    functionDomain: 'procurement',
    userName: 'Procurement Lead User',
    userEmail: 'procurement@konmaxperience.com',
  },
  {
    code: RoleCode.TALENT_LEAD,
    name: 'Talent Lead',
    description: 'Onboarding, training, hiring, team readiness.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.CREATE_TASK,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
    ],
    functionDomain: 'talent',
    userName: 'Talent Lead User',
    userEmail: 'talent@konmaxperience.com',
  },
  {
    code: RoleCode.TECH_LEAD,
    name: 'Tech Lead',
    description: 'Dashboard, automations, integrations, system infrastructure.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.CREATE_TASK,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.MANAGE_SYSTEM,
    ],
    functionDomain: 'tech',
    userName: 'Tech Lead User',
    userEmail: 'tech@konmaxperience.com',
  },
  {
    code: RoleCode.DESIGN_OUTREACH_LEAD,
    name: 'Design/Outreach Lead',
    description: 'Design language, storytelling, experience design, partnerships.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.CREATE_TASK,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'design',
    userName: 'Design/Outreach Lead User',
    userEmail: 'design@konmaxperience.com',
  },
];

const READINESS_METERS = [
  { code: 'VILLA', name: 'Villa Readiness', description: 'Overall villa setup and space readiness' },
  { code: 'BACKEND', name: 'Backend Readiness', description: 'Food production, R&D, and standardization readiness' },
  { code: 'FRONTEND', name: 'Frontend Readiness', description: 'Customer-facing service and experience readiness' },
  { code: 'PROCUREMENT', name: 'Procurement Readiness', description: 'Vendor sourcing and inventory readiness' },
  { code: 'STANDARDIZATION', name: 'Standardization Readiness', description: 'SOPs, recipes, and process documentation readiness' },
  { code: 'SALES', name: 'Sales Readiness', description: 'Sales channels and revenue pipeline readiness' },
  { code: 'TECH', name: 'Tech Readiness', description: 'Dashboard, automation, and system infrastructure readiness' },
  { code: 'TALENT', name: 'Talent Readiness', description: 'Team hiring, training, and onboarding readiness' },
  { code: 'ART_EXPERIENCE', name: 'Art Experience Readiness', description: 'Art program and experience design readiness' },
  { code: 'LIFESTYLE_EXPERIENCE', name: 'Lifestyle Experience Readiness', description: 'Lifestyle program and experience design readiness' },
];

const ZONES = [
  { name: 'Food Innovation Lab', zone_type: 'food_lab' },
  { name: 'Production Kitchen', zone_type: 'production_kitchen' },
  { name: 'Frontend Experience Zone', zone_type: 'experience_zone' },
  { name: 'Procurement & Storage', zone_type: 'storage' },
  { name: 'Intelligence & Planning Desk', zone_type: 'ops_desk' },
  { name: 'Brand Showcase / Experience Space', zone_type: 'brand_showcase' },
  { name: 'Art Zone', zone_type: 'art_zone' },
  { name: 'Lifestyle Zone', zone_type: 'lifestyle_zone' },
];

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, BCRYPT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    // Upsert roles
    const roleRecords: Record<string, string> = {};
    for (const seed of ROLE_SEEDS) {
      const role = await tx.role.upsert({
        where: { code: seed.code },
        update: {
          name: seed.name,
          description: seed.description,
          permissions: seed.permissions,
        },
        create: {
          code: seed.code,
          name: seed.name,
          description: seed.description,
          permissions: seed.permissions,
        },
      });
      roleRecords[seed.code] = role.id;
    }

    // Upsert users (one per role)
    for (const seed of ROLE_SEEDS) {
      await tx.user.upsert({
        where: { email: seed.userEmail },
        update: {
          name: seed.userName,
          role_id: roleRecords[seed.code],
          function: seed.functionDomain,
        },
        create: {
          name: seed.userName,
          email: seed.userEmail,
          password_hash: passwordHash,
          role_id: roleRecords[seed.code],
          function: seed.functionDomain,
          status: 'active',
        },
      });
    }

    // Upsert readiness meters
    for (const meter of READINESS_METERS) {
      await tx.readinessMeter.upsert({
        where: { code: meter.code },
        update: {
          name: meter.name,
          description: meter.description,
        },
        create: {
          code: meter.code,
          name: meter.name,
          description: meter.description,
        },
      });
    }

    // Create zones (delete and recreate for idempotency)
    await tx.zone.deleteMany({});
    for (const zone of ZONES) {
      await tx.zone.create({
        data: {
          name: zone.name,
          zone_type: zone.zone_type,
          status: 'planned',
        },
      });
    }

    // Upsert system settings
    await tx.systemSetting.upsert({
      where: { key: 'leaderboard_enabled' },
      update: {},
      create: { key: 'leaderboard_enabled', value: 'true' },
    });
  });

  console.log('Seed completed successfully!');
  console.log(`  - ${ROLE_SEEDS.length} roles`);
  console.log(`  - ${ROLE_SEEDS.length} users (one per role)`);
  console.log(`  - ${READINESS_METERS.length} readiness meters`);
  console.log('  - 1 system setting (leaderboard_enabled)');
  console.log(`  - ${ZONES.length} zones`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
