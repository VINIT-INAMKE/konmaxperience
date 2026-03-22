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
    permissions: Object.values(Permission),
    functionDomain: 'operations',
    userName: 'Admin',
    userEmail: 'admin@konma.store',
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
    userName: 'Anchitha',
    userEmail: 'anchitha@konma.store',
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
    userName: 'Sadhana',
    userEmail: 'sadhana@konma.store',
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
      Permission.MANAGE_KPIS,
    ],
    functionDomain: 'bi',
    userName: 'Hasmitha',
    userEmail: 'hasmitha@konma.store',
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
      Permission.MANAGE_INVENTORY,
      Permission.MANAGE_PROCUREMENT,
      Permission.MANAGE_KITCHEN,
    ],
    functionDomain: 'procurement',
    userName: 'Surya',
    userEmail: 'surya@konma.store',
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
    userName: 'Sathya',
    userEmail: 'sathya@konma.store',
  },
  {
    code: RoleCode.TECH_LEAD,
    name: 'Tech Lead',
    description: 'Dashboard, automations, integrations, system infrastructure.',
    permissions: Object.values(Permission),
    functionDomain: 'tech',
    userName: 'Vinit',
    userEmail: 'vinit@konma.store',
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
    userName: 'Advitha',
    userEmail: 'advitha@konma.store',
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
  { name: 'Main Kitchen', zone_type: 'kitchen' },
  { name: 'Prep Station', zone_type: 'kitchen' },
  { name: 'Dining Hall', zone_type: 'dining' },
  { name: 'Garden Terrace', zone_type: 'outdoor' },
  { name: 'Workshop Studio', zone_type: 'workspace' },
  { name: 'Cold Storage', zone_type: 'storage' },
  { name: 'Office', zone_type: 'workspace' },
  { name: 'Lounge', zone_type: 'leisure' },
];

const BRANDS = [
  { name: 'Konma Food', brand_type: 'food', status: 'active' },
  { name: 'Just Craves', brand_type: 'food', status: 'active' },
];

const CHANNELS = [
  { name: 'Dine-in', channel_type: 'dine_in', status: 'planned' },
  { name: 'Delivery', channel_type: 'delivery', status: 'planned' },
  { name: 'Takeaway', channel_type: 'takeaway', status: 'planned' },
  { name: 'Retail', channel_type: 'retail', status: 'planned' },
  { name: 'Event', channel_type: 'event', status: 'planned' },
  { name: 'Workshop', channel_type: 'workshop', status: 'planned' },
  { name: 'Online', channel_type: 'online', status: 'planned' },
];

const UNIT_CONVERSIONS = [
  { from_unit: 'kg',     to_unit: 'g',      factor: 1000    },
  { from_unit: 'g',      to_unit: 'kg',     factor: 0.001   },
  { from_unit: 'L',      to_unit: 'ml',     factor: 1000    },
  { from_unit: 'ml',     to_unit: 'L',      factor: 0.001   },
  { from_unit: 'dozen',  to_unit: 'pieces', factor: 12      },
  { from_unit: 'pieces', to_unit: 'dozen',  factor: 0.08333 },
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

    // Create brands (delete and recreate for idempotency)
    await tx.brand.deleteMany({});
    for (const brand of BRANDS) {
      await tx.brand.create({ data: { name: brand.name, brand_type: brand.brand_type, status: brand.status } });
    }

    // Create channels (delete and recreate for idempotency)
    await tx.channel.deleteMany({});
    for (const channel of CHANNELS) {
      await tx.channel.create({ data: { name: channel.name, channel_type: channel.channel_type, status: channel.status } });
    }

    // Seed unit conversions
    await tx.unitConversion.deleteMany({});
    for (const uc of UNIT_CONVERSIONS) {
      await tx.unitConversion.create({ data: uc });
    }

    // Upsert system settings
    await tx.systemSetting.upsert({
      where: { key: 'leaderboard_enabled' },
      update: {},
      create: { key: 'leaderboard_enabled', value: 'true' },
    });

    // Seed guide sections and pages
    await tx.guidePage.deleteMany({});
    await tx.guideSection.deleteMany({});

    const guideSections = [
      {
        title: 'Kitchen Operations',
        slug: 'kitchen-operations',
        description: 'Everything about running the production kitchen — prep batches, KDS, waste logging, and expiry management.',
        icon: 'ChefHat',
        accent_color: '#FF6B35',
        role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'PRODUCTION_LEAD', 'FRONTEND_EXPERIENCE_LEAD'],
        sort_order: 1,
        status: 'published',
        pages: [
          {
            title: 'Getting Started in the Kitchen',
            slug: 'getting-started',
            summary: 'Your first steps in the Konma kitchen — understanding zones, equipment, and daily routines.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Welcome to the Konma kitchen. This guide covers your daily workflow from prep to service.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Daily Routine'}]},{type:'paragraph',content:[{type:'text',text:'Every day begins with a prep check. Open the KDS (Kitchen Display System) to see pending orders and prep tasks for the day.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Key Areas'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Zone B: Production Kitchen — where all prep and cooking happens'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Zone F: Storage — raw ingredients and cold storage'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'KDS Screen — your real-time order and prep dashboard'}]}]}]}]}),
            sort_order: 1,
            status: 'published',
          },
          {
            title: 'Creating Prep Batches',
            slug: 'creating-prep-batches',
            summary: 'How to create prep batches with FIFO ingredient deduction and stock validation.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Prep batches are the core of kitchen production. When you create a batch, the system automatically deducts ingredients using FIFO (First In, First Out).'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Step-by-Step'}]},{type:'orderedList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Navigate to Kitchen → Prep Batches'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Click "New Batch" and select a recipe'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Enter the quantity you want to produce'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Review the deduction preview — this shows exactly which ingredients will be used'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Confirm to create the batch. Stock is immediately deducted.'}]}]}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Important Notes'}]},{type:'paragraph',content:[{type:'text',text:'If any ingredient is insufficient, the system will block batch creation. Check the stock levels page to see what needs restocking.'}]}]}),
            sort_order: 2,
            status: 'published',
          },
          {
            title: 'Using the KDS',
            slug: 'using-the-kds',
            summary: 'Full-screen Kitchen Display System — managing order items from pending to ready.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'The Kitchen Display System (KDS) is your real-time view of all active orders organized by zone.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'How It Works'}]},{type:'paragraph',content:[{type:'text',text:'Orders appear as cards grouped by zone. Each card shows the order items that need preparation in your zone.'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Tap a card to advance its status: Pending → Preparing → Ready'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'When all items are marked Ready, the order automatically transitions'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'The elapsed timer shows how long each order has been waiting'}]}]}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Tips'}]},{type:'paragraph',content:[{type:'text',text:'The KDS refreshes every 5 seconds. New orders will flash briefly to catch your attention. Use the full-screen button for distraction-free operation.'}]}]}),
            sort_order: 3,
            status: 'published',
          },
        ],
      },
      {
        title: 'POS & Orders',
        slug: 'pos-orders',
        description: 'How to take orders, process payments, manage delivery, and handle the daily sales workflow.',
        icon: 'ShoppingCart',
        accent_color: '#6366F1',
        role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'FRONTEND_EXPERIENCE_LEAD'],
        sort_order: 2,
        status: 'published',
        pages: [
          {
            title: 'Taking an Order',
            slug: 'taking-an-order',
            summary: 'Step-by-step guide to placing orders through the POS terminal.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'The POS is a split-screen interface: menu grid on the left, cart on the right.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Placing an Order'}]},{type:'orderedList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Select the channel (dine-in, takeaway, or delivery)'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Tap menu items to add them to the cart'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Adjust quantities using the +/- buttons in the cart'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Add item notes if needed (e.g., "no onions")'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'For delivery: enter customer name, phone, and address'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Click "Place Order" — the order goes straight to the KDS'}]}]}]},{type:'paragraph',content:[{type:'text',text:'The entire flow should take about 30 seconds for a standard order.'}]}]}),
            sort_order: 1,
            status: 'published',
          },
          {
            title: 'Processing Payments',
            slug: 'processing-payments',
            summary: 'Recording payments and handling the daily revenue summary.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Payments are recorded after the order is placed. The system supports cash, card, and UPI methods.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Recording a Payment'}]},{type:'orderedList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Go to Orders → find the order'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Open the order detail sheet'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Select payment method and enter amount'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Click "Record Payment"'}]}]}]},{type:'paragraph',content:[{type:'text',text:'The daily revenue summary updates automatically on the POS dashboard.'}]}]}),
            sort_order: 2,
            status: 'published',
          },
        ],
      },
      {
        title: 'Inventory & Procurement',
        slug: 'inventory-procurement',
        description: 'Managing stock levels, creating purchase orders, receiving deliveries, and tracking movements.',
        icon: 'Package',
        accent_color: '#10B981',
        role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'PROCUREMENT_LEAD'],
        sort_order: 3,
        status: 'published',
        pages: [
          {
            title: 'Checking Stock Levels',
            slug: 'checking-stock-levels',
            summary: 'How to view current stock, identify low-stock items, and read the movement audit trail.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'The Inventory page shows current stock levels for all ingredients across zones.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Low Stock Alerts'}]},{type:'paragraph',content:[{type:'text',text:'Items below their minimum stock level are highlighted with a warning badge. These need immediate attention — either create a purchase order or adjust the minimum if it was set too high.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Movement Trail'}]},{type:'paragraph',content:[{type:'text',text:'Click any ingredient to see its full movement history: purchases received, prep batch deductions, waste, and manual adjustments. This is your audit trail.'}]}]}),
            sort_order: 1,
            status: 'published',
          },
        ],
      },
      {
        title: 'Missions & Tasks',
        slug: 'missions-tasks',
        description: 'Understanding the mission/quest/task hierarchy, tracking progress, and earning XP.',
        icon: 'Target',
        accent_color: '#F59E0B',
        role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'PRODUCTION_LEAD', 'FRONTEND_EXPERIENCE_LEAD', 'BI_LEAD', 'PROCUREMENT_LEAD', 'TALENT_LEAD', 'DESIGN_OUTREACH_LEAD'],
        sort_order: 4,
        status: 'published',
        pages: [
          {
            title: 'How Missions Work',
            slug: 'how-missions-work',
            summary: 'The big picture — missions, quests, and tasks explained.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Everything in Konma is organized in a three-level hierarchy: Missions → Quests → Tasks.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Missions'}]},{type:'paragraph',content:[{type:'text',text:'Missions are the big goals — 6 to 9 month objectives that define where the team is headed. Think of them as projects.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Quests'}]},{type:'paragraph',content:[{type:'text',text:'Quests are weekly sprints within a mission. Each quest has an owner and a set of tasks to complete.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Tasks'}]},{type:'paragraph',content:[{type:'text',text:'Tasks are the daily work items. Complete them, attach evidence, get approval, and earn XP. Tasks come in three types:'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'CORE tasks (100% XP) — planned roadmap work'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'ADHOC tasks (70% XP) — urgent fixes and responses'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'IMPROVEMENT tasks (80% XP) — proactive enhancements'}]}]}]}]}),
            sort_order: 1,
            status: 'published',
          },
        ],
      },
      {
        title: 'Recipes & Menu',
        slug: 'recipes-menu',
        description: 'Creating recipes, managing the bill of materials, cost calculations, and menu item setup.',
        icon: 'BookOpen',
        accent_color: '#EC4899',
        role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'PRODUCTION_LEAD', 'BI_LEAD'],
        sort_order: 5,
        status: 'published',
        pages: [
          {
            title: 'Creating a Recipe',
            slug: 'creating-a-recipe',
            summary: 'The 3-step recipe wizard — from basic details to BOM to cost review.',
            content: JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Recipes are created using a 3-step wizard that guides you through the process.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Step 1: Basic Details'}]},{type:'paragraph',content:[{type:'text',text:'Enter the recipe name, description, cooking method, yield quantity and unit, portion size, and shelf life. Select the brand and zone.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Step 2: Bill of Materials'}]},{type:'paragraph',content:[{type:'text',text:'Add ingredients and sub-recipes that make up this recipe. For each line, specify the quantity and unit. The system handles unit conversions automatically.'}]},{type:'heading',attrs:{level:2},content:[{type:'text',text:'Step 3: Cost Review'}]},{type:'paragraph',content:[{type:'text',text:'Review the computed cost based on the latest vendor prices. The cost updates automatically when vendor prices change. Once satisfied, save the recipe and change its status to "approved" to make it available for menu items.'}]}]}),
            sort_order: 1,
            status: 'published',
          },
        ],
      },
    ];

    for (const section of guideSections) {
      const { pages, ...sectionData } = section;
      const created = await tx.guideSection.create({ data: sectionData });
      for (const page of pages) {
        await tx.guidePage.create({
          data: { ...page, section_id: created.id, estimated_read_time: Math.ceil(JSON.stringify(page.content).length / 1000) },
        });
      }
    }
  });

  console.log('Seed completed successfully!');
  console.log(`  - ${ROLE_SEEDS.length} roles`);
  console.log(`  - ${ROLE_SEEDS.length} users (one per role)`);
  console.log(`  - ${READINESS_METERS.length} readiness meters`);
  console.log('  - 1 system setting (leaderboard_enabled)');
  console.log(`  - ${ZONES.length} zones`);
  console.log(`  - ${BRANDS.length} brands`);
  console.log(`  - ${CHANNELS.length} channels`);
  console.log(`  - ${UNIT_CONVERSIONS.length} unit conversions`);
  console.log('  - 5 guide sections with 8 pages');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
