import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RoleCode } from '../src/types/roles';
import { Permission } from '../src/types/permissions';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

interface RoleSeed {
  code: RoleCode;
  name: string;
  description: string;
  permissions: Permission[];
  functionDomain: string;
  userName: string;
  userEmail: string;
  password: string;
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
    password: 'admin@konma123',
  },
  {
    code: RoleCode.FRONTEND_LEAD,
    name: 'Frontend Lead',
    description: 'Customer flow, service, beverage, space interaction, channels.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'food',
    userName: 'Advitha2',
    userEmail: 'advitha2@konma.store',
    password: 'advitha2@konma123',
  },
  {
    code: RoleCode.BACKEND_LEAD,
    name: 'Backend Lead',
    description: 'Food, production, R&D, standardization, quality.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'food',
    userName: 'Sadhana',
    userEmail: 'sadhana@konma.store',
    password: 'sadhana@konma123',
  },
  {
    code: RoleCode.BI_LEAD,
    name: 'BI Lead',
    description: 'Costing, pricing, KPIs, performance analytics.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.CREATE_DECISION,
      Permission.MANAGE_KPIS,
    ],
    functionDomain: 'bi',
    userName: 'Hasmitha',
    userEmail: 'hasmitha@konma.store',
    password: 'hasmitha@konma123',
  },
  {
    code: RoleCode.PROCUREMENT_LEAD,
    name: 'Procurement Lead',
    description: 'Vendors, sourcing, inventory management.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
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
    password: 'surya@konma123',
  },
  {
    code: RoleCode.TALENT_LEAD,
    name: 'Talent Lead',
    description: 'Onboarding, training, hiring, team readiness.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
    ],
    functionDomain: 'talent',
    userName: 'Sathya',
    userEmail: 'sathya@konma.store',
    password: 'sathya@konma123',
  },
  {
    code: RoleCode.TECH_LEAD,
    name: 'Tech Lead',
    description: 'Dashboard, automations, integrations, system infrastructure.',
    permissions: Object.values(Permission),
    functionDomain: 'tech',
    userName: 'Vinit',
    userEmail: 'vinit@konma.store',
    password: 'vinit@konma123',
  },
  {
    code: RoleCode.DESIGN_OUTREACH_LEAD,
    name: 'Design/Outreach Lead',
    description: 'Design language, storytelling, experience design, partnerships.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'design',
    userName: 'Advitha',
    userEmail: 'advitha@konma.store',
    password: 'advitha@konma123',
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

// --- Tiptap JSON helpers ---

function p(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function h2(text: string) {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] };
}

function h3(text: string) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] };
}

function li(text: string) {
  return { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

function liBold(bold: string, rest: string) {
  return {
    type: 'listItem',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: bold, marks: [{ type: 'bold' }] },
        { type: 'text', text: rest },
      ],
    }],
  };
}

function ul(...items: ReturnType<typeof li>[]) {
  return { type: 'bulletList', content: items };
}

function ol(...items: ReturnType<typeof li>[]) {
  return { type: 'orderedList', content: items };
}

function doc(...content: object[]) {
  return JSON.stringify({ type: 'doc', content });
}

// --- Read time helper (word count / 200 wpm) ---
function computeReadTime(content: string): number {
  const text = content.replace(/"text":"([^"]+)"/g, '$1 ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const ALL_ROLES = [
  'FOUNDER_ADMIN', 'FRONTEND_LEAD', 'BACKEND_LEAD', 'BI_LEAD',
  'PROCUREMENT_LEAD', 'TALENT_LEAD', 'TECH_LEAD', 'DESIGN_OUTREACH_LEAD',
];

// ============================================================
// GUIDE SECTIONS AND PAGES
// ============================================================

const guideSections = [
  // ── Section 1: Kitchen Operations (5 pages) ───────────────
  {
    title: 'Kitchen Operations',
    slug: 'kitchen-operations',
    description: 'Everything about running the production kitchen — prep batches, KDS, waste logging, and expiry management.',
    icon: 'ChefHat',
    accent_color: '#FF6B35',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'BACKEND_LEAD', 'PROCUREMENT_LEAD'],
    sort_order: 1,
    status: 'published',
    pages: [
      {
        title: 'Getting Started in the Kitchen',
        slug: 'getting-started',
        summary: 'Your first steps in the Konma kitchen — understanding zones, equipment, and daily routines.',
        content: doc(
          p('Welcome to the Konma kitchen. This guide covers your daily workflow from morning prep through to end-of-day cleanup.'),
          h2('Daily Routine'),
          p('Every day begins with a prep check. Open the Kitchen Display System (KDS) from the sidebar under Kitchen to see pending orders and prep tasks for the day.'),
          h2('Key Areas'),
          ul(
            liBold('Main Kitchen', ' — the primary production area where all cooking and plating happens. Most prep batches are created here.'),
            liBold('Prep Station', ' — a secondary kitchen zone used for ingredient preparation, portioning, and mise en place.'),
            liBold('Cold Storage', ' — raw ingredients and perishable items. Check expiry dates here regularly.'),
            liBold('KDS Screen', ' — your real-time order and prep dashboard. Access it from Kitchen > KDS in the sidebar.'),
          ),
          h2('Navigation'),
          p('The Kitchen section in the sidebar has three sub-pages: KDS for live order tracking, Prep Batches for production runs, and Waste Log for recording spoilage and losses.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Creating Prep Batches',
        slug: 'creating-prep-batches',
        summary: 'How to create prep batches with FIFO ingredient deduction and stock validation.',
        content: doc(
          p('Prep batches are the core of kitchen production. When you create a batch, the system automatically deducts ingredients from stock using FIFO (First In, First Out) ordering, consuming the oldest stock first.'),
          h2('Step-by-Step'),
          ol(
            li('Navigate to Kitchen > Prep Batches in the sidebar'),
            li('Click the "New Batch" button in the top-right corner'),
            li('The Prep Batch Wizard opens as a slide-in sheet. Select a recipe from the dropdown — only approved recipes are shown'),
            li('Enter the number of batches you want to produce. The BOM quantities scale automatically'),
            li('Click "Preview Deductions" to see exactly which ingredient stocks will be consumed and in what quantities'),
            li('Review the deduction preview carefully. Each line shows the ingredient, the zone it will be drawn from, and the quantity'),
            li('Click "Create Batch" to confirm. Stock is immediately deducted and a movement audit entry is recorded for each ingredient'),
          ),
          h2('Important Notes'),
          ul(
            li('If any ingredient has insufficient stock, the system blocks batch creation and highlights the shortfall'),
            li('Deductions follow FIFO — the oldest received stock in each zone is consumed first'),
            li('After creation, the batch appears in the Prep Batch list with its status, recipe name, and quantity produced'),
            li('You can filter the batch list by zone or status using the dropdowns above the table'),
          ),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Using the KDS',
        slug: 'using-the-kds',
        summary: 'Full-screen Kitchen Display System — managing order items from pending to ready.',
        content: doc(
          p('The Kitchen Display System (KDS) is a full-screen, real-time view of all active orders. It is designed to run on a dedicated screen in the kitchen.'),
          h2('Layout'),
          p('The KDS page takes over the entire viewport with a dark background for readability. The top bar shows the title "Kitchen Display", a metrics bar with order counts, and an exit button to return to the normal interface.'),
          h2('How Order Cards Work'),
          ul(
            li('Each order appears as a card showing its items, quantities, and elapsed time since the order was placed'),
            li('Items are grouped by the zone they need to be prepared in'),
            li('Tap an item to advance its status through: Pending > Preparing > Ready'),
            li('When all items in an order are marked Ready, the order automatically transitions to the ready state'),
          ),
          h2('Tips for Kitchen Staff'),
          ul(
            li('The KDS auto-refreshes. New orders appear automatically without manual refresh'),
            li('The elapsed timer on each card helps you prioritize — older orders should be prepared first'),
            li('Use the full-screen button at the top for a distraction-free display on a wall-mounted monitor'),
            li('The metrics bar shows total pending, preparing, and ready counts at a glance'),
          ),
        ),
        sort_order: 3,
        status: 'published',
      },
      {
        title: 'Logging Waste',
        slug: 'logging-waste',
        summary: 'How to record waste from spoilage, over-prep, cooking errors, and expired ingredients.',
        content: doc(
          p('Waste logging helps track ingredient losses and their cost impact. Every waste entry creates an audit trail that feeds into analytics for identifying patterns.'),
          h2('The Waste Log Page'),
          p('Navigate to Kitchen > Waste Log. The page has a two-column layout: a waste history table on the left (showing date, type, item, quantity, reason, cost impact, and who logged it) and a waste log form on the right.'),
          h2('Recording a Waste Entry'),
          ol(
            li('In the form on the right side, select the waste type: "ingredient" for raw materials or "prep_batch" for prepared items'),
            li('Select the specific ingredient or prep batch from the dropdown'),
            li('Enter the quantity wasted and the unit (e.g., 0.5 kg)'),
            li('Choose a reason from the dropdown: Spoilage, Over-prep, Cooking Error, Expired, or Other'),
            li('Optionally add notes explaining the circumstances'),
            li('Select the zone where the waste occurred (Main Kitchen, Prep Station, or Cold Storage)'),
            li('Click "Log Waste" to save the entry'),
          ),
          h2('Waste Categories Explained'),
          ul(
            liBold('Spoilage', ' — ingredient deteriorated before use (e.g., vegetables wilted)'),
            liBold('Over-prep', ' — more was prepared than needed for the day'),
            liBold('Cooking Error', ' — batch ruined during cooking (e.g., burnt, wrong proportions)'),
            liBold('Expired', ' — item passed its use-by date before being used'),
            liBold('Other', ' — any reason not covered above; use the notes field to explain'),
          ),
          h2('Reviewing Waste Reports'),
          p('The waste history table shows all logged entries with their cost impact calculated from ingredient prices. Use this data to identify recurring issues — if spoilage is high for a particular ingredient, review your ordering quantities or storage practices.'),
        ),
        sort_order: 4,
        status: 'published',
      },
      {
        title: 'Expiry Management',
        slug: 'expiry-management',
        summary: 'How the system flags items approaching expiry and how to act on expiry alerts.',
        content: doc(
          p('The system runs a background job that checks ingredient stock for items approaching their expiry date. When stock is close to expiring, alerts appear on the dashboard so you can use it, discount it, or log it as waste.'),
          h2('How Expiry Tracking Works'),
          ul(
            li('Each ingredient stock record has an optional expiry date set when the stock is received via a purchase order'),
            li('A scheduled cron job scans all stock records and flags items expiring within the configured threshold'),
            li('Flagged items generate notifications for users with the MANAGE_KITCHEN permission'),
          ),
          h2('Acting on Expiry Alerts'),
          ol(
            li('Check the dashboard for low-stock and expiry alerts in the Intelligence section'),
            li('Navigate to Inventory to see which specific items are flagged'),
            li('For items nearing expiry: prioritize them in your next prep batch to use them first'),
            li('For items past expiry: log them in the Waste Log with reason "Expired" so the cost impact is tracked'),
            li('Adjust future purchase order quantities to reduce over-stocking of perishable items'),
          ),
          h2('Best Practices'),
          ul(
            li('Always record expiry dates when receiving purchase orders — the system cannot track what it does not know'),
            li('Review the waste log weekly for expired items to identify ordering patterns'),
            li('FIFO deduction in prep batches already helps — oldest stock is used first automatically'),
          ),
        ),
        sort_order: 5,
        status: 'published',
      },
    ],
  },

  // ── Section 2: POS & Orders (4 pages) ─────────────────────
  {
    title: 'POS & Orders',
    slug: 'pos-orders',
    description: 'How to take orders, process payments, manage deliveries, and view the daily revenue summary.',
    icon: 'ShoppingCart',
    accent_color: '#6366F1',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'FRONTEND_LEAD'],
    sort_order: 2,
    status: 'published',
    pages: [
      {
        title: 'Taking an Order',
        slug: 'taking-an-order',
        summary: 'Step-by-step guide to placing orders through the split-screen POS terminal.',
        content: doc(
          p('The POS is a split-screen interface: a menu grid on the left and a cart sidebar on the right. On mobile, the cart slides in from the right as a sheet.'),
          h2('Placing an Order'),
          ol(
            li('Open POS from the sidebar. The page loads with the first active food brand selected'),
            li('If you have multiple brands (e.g., Konma Food, Just Craves), switch between them using the brand tabs above the menu grid'),
            li('Select the order channel in the cart sidebar: Dine-in, Takeaway, or Delivery. This determines which extra fields appear'),
            li('Tap menu items in the grid to add them to the cart. Items show their base price and availability badge'),
            li('Adjust quantities using the +/- buttons next to each cart item. Tap "-" to zero to remove an item'),
            li('For dine-in: enter the table number. For delivery: enter customer name, phone, and delivery address'),
            li('Add any order notes in the notes field (e.g., "extra spicy", "no contact delivery")'),
            li('Click "Place Order" — the order is sent to the backend, appears immediately on the KDS, and the cart resets'),
          ),
          h2('Terminal Mode'),
          p('Click the "Terminal Mode" shimmer button in the header to enter a full-screen mode optimized for a dedicated POS tablet. Press "Exit Terminal" to return to normal view.'),
          h2('Availability'),
          p('Each menu item shows a live availability count (number of servings that can be made from current stock). Items with zero availability are dimmed. The availability refreshes automatically every 10 seconds.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Processing Payments',
        slug: 'processing-payments',
        summary: 'Recording payment method and amount against an order.',
        content: doc(
          p('Payments are recorded after the order is placed. The system tracks payment method, amount, and any split-payment notes. There is no payment gateway — this is a manual recording system.'),
          h2('Recording a Payment'),
          ol(
            li('Go to the Orders list (accessible from the sidebar or by navigating after placing an order)'),
            li('Find the order by its short ID (the last 4 characters of the UUID, shown in the success toast)'),
            li('Open the order detail sheet by clicking the order row'),
            li('Select the payment method: Cash, Card, or UPI'),
            li('Enter the payment amount. The system shows the order total for reference'),
            li('Click "Record Payment" to save'),
          ),
          h2('Payment Methods'),
          ul(
            liBold('Cash', ' — physical currency. Record the exact amount received'),
            liBold('Card', ' — credit or debit card swipe. Record after the terminal confirms'),
            liBold('UPI', ' — digital payment via UPI apps. Record after confirming receipt in your bank app'),
          ),
          h2('Split Payments'),
          p('If a customer wants to pay partially with cash and partially with card, use the notes field to record the split details. The system records one payment entry per order, so note the breakdown in the order notes.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Managing Deliveries',
        slug: 'managing-deliveries',
        summary: 'Delivery queue, status tracking, and driver assignment for delivery orders.',
        content: doc(
          p('When an order is placed with the "delivery" channel, it includes customer name, phone, delivery address, and optionally a driver assignment. The order follows a delivery-specific status flow.'),
          h2('Delivery Status Flow'),
          ol(
            li('Placed — order just created, visible on KDS for kitchen preparation'),
            li('Preparing — kitchen has started working on the order'),
            li('Ready — all items prepared, waiting for dispatch'),
            li('Dispatched — driver has picked up the order and is en route'),
            li('Served — delivery completed (this is the terminal status for deliveries)'),
          ),
          h2('Updating Delivery Info'),
          p('From the order detail view, use the delivery section to assign or change the driver name and update the delivery status. The delivery fields are simple text inputs — enter the driver name directly.'),
          h2('Tips'),
          ul(
            li('Always fill in the customer phone number at order time — the driver needs it for delivery coordination'),
            li('Update the status to "Dispatched" as soon as the driver leaves so the team knows the order is out'),
            li('The order list can be filtered by status, making it easy to see all orders awaiting dispatch'),
          ),
        ),
        sort_order: 3,
        status: 'published',
      },
      {
        title: 'Daily Revenue Summary',
        slug: 'daily-revenue-summary',
        summary: 'Viewing the daily revenue breakdown by payment method and order count.',
        content: doc(
          p('The daily revenue summary provides a quick snapshot of the day\'s sales performance. It is accessible via the orders API daily-summary endpoint and displayed on the POS dashboard area.'),
          h2('What the Summary Shows'),
          ul(
            li('Total revenue for the selected date'),
            li('Total number of orders'),
            li('Breakdown by payment method (cash, card, UPI) showing count and amount for each'),
            li('Average order value'),
          ),
          h2('Accessing the Summary'),
          ol(
            li('The daily summary defaults to today\'s date'),
            li('You can query a specific date by passing a date parameter'),
            li('The summary updates in real-time as new payments are recorded throughout the day'),
          ),
          h2('Using the Data'),
          p('Track daily revenue trends to understand peak days, preferred payment methods, and average ticket size. This feeds into the broader analytics available on the Analytics page for longer-term trend analysis.'),
        ),
        sort_order: 4,
        status: 'published',
      },
    ],
  },

  // ── Section 3: Inventory & Procurement (3 pages) ──────────
  {
    title: 'Inventory & Procurement',
    slug: 'inventory-procurement',
    description: 'Managing stock levels, low-stock alerts, purchase orders, vendor tracking, and the movement audit trail.',
    icon: 'Package',
    accent_color: '#10B981',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'PROCUREMENT_LEAD'],
    sort_order: 3,
    status: 'published',
    pages: [
      {
        title: 'Checking Stock Levels',
        slug: 'checking-stock-levels',
        summary: 'How to view current stock, filter by category and zone, identify low-stock items, and read the movement audit trail.',
        content: doc(
          p('The Inventory page shows current stock levels for all ingredients across all zones. It is the primary tool for the Procurement Lead to monitor what needs restocking.'),
          h2('Page Layout'),
          p('The page has a filter bar at the top with three controls: a category dropdown (e.g., Dairy, Produce, Spices), a zone dropdown (Main Kitchen, Cold Storage, etc.), and a search field for finding ingredients by name.'),
          h2('Low Stock Alerts'),
          p('An amber alert strip appears below the header when any ingredients are below their minimum stock level. It shows the count of affected items (e.g., "3 ingredients below minimum stock level. Review and reorder."). Items in the table that are below minimum are highlighted.'),
          h2('Stock Table Columns'),
          ul(
            liBold('Name', ' — the ingredient name'),
            liBold('Category', ' — ingredient category (Dairy, Produce, Grains, Spices, etc.)'),
            liBold('Zone', ' — which zone holds this stock'),
            liBold('Current Stock', ' — quantity currently available with unit'),
            liBold('Min Level', ' — the configured minimum stock threshold'),
            liBold('Status', ' — OK or Low Stock badge'),
            liBold('Actions', ' — click to view movement history'),
          ),
          h2('Stock Adjustments'),
          p('Click "Adjust Stock" to open the Stock Adjustment sheet. Enter the ingredient, zone, adjustment quantity (positive to add, negative to deduct), and a reason. This creates an audited stock movement record.'),
          h2('Movement Audit Trail'),
          p('Click any ingredient row to see its complete movement history: purchase order receipts (positive), prep batch deductions (negative), waste log entries (negative), and manual adjustments. Each entry is timestamped and linked to the source record.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Creating Purchase Orders',
        slug: 'creating-purchase-orders',
        summary: 'The purchase order workflow from creation through receiving and stock update.',
        content: doc(
          p('Purchase orders (POs) are how raw ingredients enter the system. The PO workflow ensures every stock addition is tracked with vendor, quantity, cost, and receipt date.'),
          h2('Creating a Purchase Order'),
          ol(
            li('Navigate to Operations > Procurement from the sidebar'),
            li('The procurement dashboard shows summary cards: pending PO count, low-stock items, vendor spend this month, and total inventory value'),
            li('To create a new PO, select a vendor and add line items specifying the ingredient, quantity, unit, and unit price'),
            li('Submit the PO — it enters "pending" status'),
          ),
          h2('Receiving a Purchase Order'),
          ol(
            li('When the delivery arrives, open the pending PO'),
            li('Verify quantities against the physical delivery'),
            li('Mark each line as received with the actual quantity (supports partial receiving)'),
            li('On confirmation, stock levels are automatically increased and a stock movement entry is created for each ingredient'),
          ),
          h2('Partial Receiving'),
          p('If a vendor delivers only part of an order, you can receive what arrived and leave the rest pending. The system tracks received vs ordered quantities per line item.'),
          h2('Tips'),
          ul(
            li('Set expiry dates during receiving — this enables the expiry management system to track perishable items'),
            li('Review the vendor spend breakdown on the procurement dashboard to identify cost trends'),
            li('The "Top Vendors by Spend" table shows your highest-cost suppliers at a glance'),
          ),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Managing Vendors',
        slug: 'managing-vendors',
        summary: 'Vendor list, contact information, pricing per ingredient, and spend tracking.',
        content: doc(
          p('Vendors are the suppliers who provide raw ingredients. The system tracks vendor contact details, per-ingredient pricing, and total spend for cost analysis.'),
          h2('Vendor Information'),
          p('Each vendor record includes name, contact phone, email, and address. This information is referenced when creating purchase orders — selecting a vendor auto-populates pricing for ingredients they supply.'),
          h2('Vendor Pricing'),
          ul(
            li('Each vendor can have prices set for specific ingredients'),
            li('When creating a PO, the unit price pre-fills from the vendor\'s recorded pricing'),
            li('Pricing history is tracked — when a vendor changes their price, previous PO records retain the original price'),
          ),
          h2('Comparing Vendor Prices'),
          p('Use the procurement dashboard to compare vendor spend. The "Top Vendors by Spend" table shows the three highest-spend vendors this month. For per-ingredient price comparison, review vendor pricing records to find the most cost-effective supplier for each ingredient.'),
          h2('Best Practices'),
          ul(
            li('Keep vendor contact information up to date for quick communication during delivery issues'),
            li('Record accurate per-ingredient pricing — this flows into recipe cost calculations'),
            li('Review monthly spend patterns to negotiate better rates with high-volume vendors'),
          ),
        ),
        sort_order: 3,
        status: 'published',
      },
    ],
  },

  // ── Section 4: Recipes & Menu (3 pages) ───────────────────
  {
    title: 'Recipes & Menu',
    slug: 'recipes-menu',
    description: 'Creating recipes with the 3-step wizard, managing menu categories and items, channel pricing, and cost analysis.',
    icon: 'BookOpen',
    accent_color: '#EC4899',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'BACKEND_LEAD', 'BI_LEAD'],
    sort_order: 4,
    status: 'published',
    pages: [
      {
        title: 'Creating a Recipe',
        slug: 'creating-a-recipe',
        summary: 'The 3-step recipe wizard — from basic details to BOM to cost review.',
        content: doc(
          p('Recipes are the foundation of the food system. They define what ingredients are needed (the Bill of Materials), how much each batch produces, and what it costs. Recipes are created using a 3-step wizard.'),
          h2('Step 1: Basic Details'),
          p('Enter the recipe name, description, cooking method, yield quantity and unit (e.g., 10 portions), portion size, and shelf life. Select the brand (Konma Food or Just Craves) and the production zone. Set the status to "draft" initially.'),
          h2('Step 2: Bill of Materials (BOM)'),
          p('Add each ingredient or sub-recipe that makes up this recipe. For each BOM line, specify the quantity and unit. The system handles unit conversions automatically — if the recipe calls for 500g of flour but your stock is in kg, the conversion is applied when deducting.'),
          ul(
            li('Click "Add Ingredient" to add a BOM line'),
            li('Search for the ingredient by name'),
            li('Enter the quantity per batch and select the unit'),
            li('Sub-recipes can be added as BOM lines too — this enables recursive cost calculation'),
          ),
          h2('Step 3: Cost Review'),
          p('Review the computed cost based on the latest vendor prices for each ingredient. The cost per batch and cost per portion are calculated automatically. When vendor prices change, recipe costs update too.'),
          h2('Recipe Statuses'),
          ul(
            liBold('Draft', ' — recipe is being developed, not available for menu items or prep batches'),
            liBold('Approved', ' — recipe is finalized and can be linked to menu items and used for prep batches'),
            liBold('Archived', ' — recipe is retired but retained for historical records'),
          ),
          h2('Filtering and Search'),
          p('The Recipes page shows all recipes as cards in a grid. Use the brand filter, status filter, and search field at the top to find specific recipes. Only admin users can archive recipes.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Managing Menu Items',
        slug: 'managing-menu-items',
        summary: 'Creating menu items linked to recipes, organizing by category, setting prices, and channel modifiers.',
        content: doc(
          p('Menu items are what customers see and order. Each menu item is linked to a recipe and belongs to a category within a brand.'),
          h2('Menu Page Layout'),
          p('The Menu page shows brand tabs at the top (switch between Konma Food and Just Craves). Below that, categories are displayed as sections, each containing their menu items in a grid.'),
          h2('Creating a Menu Item'),
          ol(
            li('Navigate to Operations > Menu'),
            li('Select the brand tab'),
            li('Click "Add Category" if you need a new category (e.g., Starters, Mains, Desserts, Beverages)'),
            li('Within a category, click the "+" button to add a new item'),
            li('In the Menu Item Form sheet, enter: name, base price, recipe link (optional), and description'),
            li('Toggle the availability switch to make it visible on the POS'),
            li('Save the item'),
          ),
          h2('Channel Modifiers'),
          p('Channel modifiers adjust the base price for different sales channels. For example, delivery might add 10% to cover packaging costs. The Channel Modifier Table at the bottom of the Menu page shows all active modifiers.'),
          ul(
            li('Each modifier is set per channel (Dine-in, Delivery, Takeaway, etc.)'),
            li('The modifier is a percentage or fixed amount added to the base price'),
            li('Final price = base_price + channel modifier'),
          ),
          h2('Toggling Availability'),
          p('Each menu item has an availability toggle. When an item is out of stock or temporarily unavailable, toggle it off. This immediately hides it from the POS menu grid and prevents new orders.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Understanding Recipe Costs',
        slug: 'understanding-recipe-costs',
        summary: 'How BOM costs roll up, impact of vendor price changes, and food cost percentage.',
        content: doc(
          p('Recipe costing is calculated automatically from the Bill of Materials (BOM) and current vendor prices. Understanding these numbers is essential for pricing decisions and margin management.'),
          h2('How Costs Are Calculated'),
          ul(
            li('Each BOM line has a quantity and unit. The system looks up the latest vendor price for that ingredient in the matching unit'),
            li('If the BOM uses a different unit than the vendor price (e.g., BOM in grams, vendor price in kg), the unit conversion table is applied'),
            li('Sub-recipes in the BOM use their own computed cost — this creates recursive cost roll-up'),
            li('Total batch cost = sum of all BOM line costs'),
            li('Cost per portion = total batch cost / yield quantity'),
          ),
          h2('Impact of Vendor Price Changes'),
          p('When a vendor updates their price for an ingredient, every recipe using that ingredient sees its cost change automatically on the next view. This means your food cost percentages stay accurate without manual recalculation.'),
          h2('Food Cost Percentage'),
          p('The analytics page shows recipe cost analysis with food cost percentage calculated as: (recipe cost per portion / menu item base price) x 100. A healthy food cost percentage typically ranges from 25% to 35%.'),
          h2('Using Cost Data'),
          ul(
            li('Review recipe costs before setting menu item prices to ensure adequate margins'),
            li('Monitor the Analytics > Recipe Costs report for trends in food cost percentages'),
            li('If a recipe cost spikes, check which ingredient price changed and consider alternative vendors'),
          ),
        ),
        sort_order: 3,
        status: 'published',
      },
    ],
  },

  // ── Section 5: Missions & Tasks (4 pages) ─────────────────
  {
    title: 'Missions & Tasks',
    slug: 'missions-tasks',
    description: 'Understanding the mission/quest/task hierarchy, tracking progress, completing tasks, and earning XP.',
    icon: 'Target',
    accent_color: '#F59E0B',
    role_codes: ALL_ROLES,
    sort_order: 5,
    status: 'published',
    pages: [
      {
        title: 'How Missions Work',
        slug: 'how-missions-work',
        summary: 'The big picture — missions, quests, and tasks explained.',
        content: doc(
          p('Everything in Konma is organized in a three-level hierarchy: Missions > Quests > Tasks. This structure turns big goals into daily actionable work.'),
          h2('Missions'),
          p('Missions are the big goals — 6 to 9 month objectives that define where the team is headed. Examples: "Launch Just Craves delivery channel", "Standardize all core recipes". Only users with the CREATE_MISSION permission (Admin/Tech Lead) can create missions.'),
          h2('Quests'),
          p('Quests are time-boxed sprints within a mission, typically lasting one week. Each quest has an owner, a target completion date, and a set of tasks. Quests move through statuses: Open > Active > In Review > Complete.'),
          h2('Tasks'),
          p('Tasks are the daily work items. Every team member works on tasks. Complete them, attach evidence, get approval, and earn XP. Tasks have the following statuses: Todo > In Progress > Blocked > Done.'),
          h2('Task Types and XP'),
          ul(
            liBold('CORE tasks', ' (100% XP) — planned roadmap work aligned with missions and quests'),
            liBold('ADHOC tasks', ' (70% XP) — urgent fixes, responses to real-time issues'),
            liBold('IMPROVEMENT tasks', ' (80% XP) — proactive enhancements beyond the plan'),
          ),
          p('The two execution layers — Fixed Roadmap (missions/quests/core tasks) and Ad-hoc (urgent tasks) — coexist so the team can respond to real situations without derailing long-term goals.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Working with Quests',
        slug: 'working-with-quests',
        summary: 'Quest lifecycle, ownership, adding tasks to quests, and progress tracking.',
        content: doc(
          p('Quests are the weekly sprints that break missions into manageable chunks. Each quest groups related tasks and tracks their collective progress.'),
          h2('Quest Lifecycle'),
          ol(
            li('Open — quest created with a title, description, owner, and target date'),
            li('Active — quest is currently being worked on; tasks can be added and completed'),
            li('In Review — all tasks are done but the quest needs verification'),
            li('Complete — quest is verified and closed'),
          ),
          h2('Creating a Quest'),
          ol(
            li('Navigate to the Missions page and select a mission'),
            li('Click "Create Quest" (requires CREATE_QUEST permission)'),
            li('Enter the quest title, description, and assign an owner'),
            li('Set the target completion date — typically one week from start'),
          ),
          h2('Adding Tasks to a Quest'),
          p('Within a quest, tasks can be created directly. Each task is assigned to a specific user, given a type (core, adhoc, or improvement), and linked to the quest for progress tracking.'),
          h2('Tracking Progress'),
          p('Quest progress is visible from the mission detail page. Each quest shows its completion percentage based on how many tasks are done vs total. The Boards > Missions page provides a board-style view of all quests.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Completing Tasks',
        slug: 'completing-tasks',
        summary: 'Task workflow, attaching evidence, getting approval, and the validation chain.',
        content: doc(
          p('Tasks are the atomic unit of work. Completing a task properly — with evidence and approval — is how you earn XP and contribute to readiness meters.'),
          h2('Task Workflow'),
          ol(
            li('Todo — task is assigned but not started'),
            li('In Progress — you are actively working on it (update status via the task detail page)'),
            li('Blocked — something is preventing progress. Use the Block button and enter a reason. Blocked tasks appear in the Admin blockers widget'),
            li('Done — task is complete. This requires evidence to be uploaded and approved'),
          ),
          h2('Attaching Evidence'),
          ol(
            li('Open your task from the task list or board view'),
            li('Click "Upload Evidence"'),
            li('Attach photos, screenshots, or documents (uploaded via presigned R2 URLs)'),
            li('Add a description of what the evidence shows'),
            li('Submit — the evidence enters PENDING review status'),
          ),
          h2('Approval Flow'),
          p('A reviewer with APPROVE_EVIDENCE permission reviews your evidence. They can approve (task progresses to Done) or reject with feedback (you need to resubmit). Only after approval does the task count toward XP and readiness.'),
          h2('Blocking and Unblocking'),
          ul(
            li('Use the Block button to flag a task as blocked. Enter the reason (e.g., "waiting for vendor delivery")'),
            li('Blocked tasks are visible to admin on the dashboard blockers widget'),
            li('When the blocker is resolved, use the Unblock button to return the task to its previous status'),
          ),
        ),
        sort_order: 3,
        status: 'published',
      },
      {
        title: 'XP & Leaderboard',
        slug: 'xp-and-leaderboard',
        summary: 'How XP is earned, task type multipliers, level progression, and the team leaderboard.',
        content: doc(
          p('XP (experience points) are earned when tasks are completed with approved evidence. The gamification system motivates consistent execution and recognizes top contributors.'),
          h2('How XP Is Earned'),
          p('When a task reaches "Done" status with approved evidence, XP is awarded to the assigned user. The amount depends on the task type:'),
          ul(
            liBold('CORE tasks', ' — 100% XP (base amount for planned roadmap work)'),
            liBold('IMPROVEMENT tasks', ' — 80% XP (proactive enhancements)'),
            liBold('ADHOC tasks', ' — 70% XP (urgent responses and fixes)'),
          ),
          p('This weighting ensures planned work is valued highest while still rewarding responsiveness and initiative.'),
          h2('Level Progression'),
          p('XP accumulates over time. As you earn more XP, your level increases. Levels are displayed next to your name on the leaderboard and in your profile. Higher levels reflect sustained contribution.'),
          h2('The Leaderboard'),
          p('Navigate to the Leaderboard page from the sidebar. It shows all active team members (excluding the Admin account) ranked by total XP. Your row is highlighted if you are logged in.'),
          ul(
            li('Each entry shows rank, name, function domain, XP total, and level'),
            li('The leaderboard can be toggled on/off by the admin from System Settings'),
            li('When disabled, a "Leaderboard Paused" message appears — but XP continues accumulating silently'),
          ),
          h2('Dashboard Preview'),
          p('The admin dashboard includes a leaderboard preview in the Intelligence section, showing the top ranked members without navigating to the full page.'),
        ),
        sort_order: 4,
        status: 'published',
      },
    ],
  },

  // ── Section 6: Evidence & Approvals (3 pages) ─────────────
  {
    title: 'Evidence & Approvals',
    slug: 'evidence-approvals',
    description: 'Uploading evidence for tasks, the approval review queue, and the admin override workflow.',
    icon: 'CheckCircle',
    accent_color: '#8B5CF6',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'FRONTEND_LEAD', 'BACKEND_LEAD', 'PROCUREMENT_LEAD'],
    sort_order: 6,
    status: 'published',
    pages: [
      {
        title: 'Uploading Evidence',
        slug: 'uploading-evidence',
        summary: 'What counts as evidence, how to upload files, and evidence status tracking.',
        content: doc(
          p('Evidence is the proof that a task was completed. The system requires evidence to be uploaded and approved before a task can be marked as done and XP is awarded.'),
          h2('What Counts as Evidence'),
          ul(
            li('Photos of completed work (e.g., a prepared dish, organized storage area)'),
            li('Screenshots of system changes (e.g., updated recipe, configured settings)'),
            li('Documents such as SOPs, reports, or checklists'),
            li('Any file that demonstrates the task outcome'),
          ),
          h2('How to Upload'),
          ol(
            li('Open the task you want to submit evidence for'),
            li('Click "Upload Evidence" (requires UPLOAD_EVIDENCE permission)'),
            li('Select a file from your device. The file is uploaded via a presigned R2 URL — this is fast and secure'),
            li('Add a description explaining what the evidence shows and how it relates to the task'),
            li('Submit the evidence'),
          ),
          h2('Evidence Status'),
          ul(
            liBold('PENDING', ' — uploaded but not yet reviewed. Awaiting a reviewer with APPROVE_EVIDENCE permission'),
            liBold('APPROVED', ' — reviewer confirmed the evidence is valid. Task status updates to Done and XP is awarded'),
            liBold('REJECTED', ' — reviewer found issues. You will need to upload new evidence addressing the feedback'),
          ),
          h2('Evidence Feed'),
          p('The evidence feed (Boards > Evidence) shows a scrollable list of all evidence submissions across the team, filterable by status. Use it to see what others are submitting and track pending reviews.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'The Approval Queue',
        slug: 'approval-queue',
        summary: 'Reviewing evidence, approving or rejecting with comments, and batch approval flow.',
        content: doc(
          p('The approval queue is where reviewers examine submitted evidence and make approve/reject decisions. This is a critical governance step — no task counts without approved evidence.'),
          h2('Accessing the Queue'),
          p('Navigate to Approvals from the sidebar. The page shows all pending evidence items that need review. Only users with the APPROVE_EVIDENCE permission can see and act on this queue.'),
          h2('Reviewing Evidence'),
          ol(
            li('Open a pending evidence item from the queue'),
            li('View the attached file (photo, screenshot, or document)'),
            li('Read the submitter\'s description of what was done'),
            li('Check against the task requirements to verify completeness'),
          ),
          h2('Approving'),
          p('Click the "Approve" button to approve the evidence. This triggers the following cascade:'),
          ul(
            li('Evidence status changes to APPROVED'),
            li('The associated task status updates to Done'),
            li('XP is awarded to the task assignee based on task type'),
            li('A notification is sent to the task owner confirming approval'),
          ),
          h2('Rejecting'),
          p('Click "Reject" and enter feedback explaining what is missing or incorrect. The submitter receives a notification with your rejection notes and can resubmit improved evidence.'),
          h2('Scope Filtering'),
          p('Evidence is scope-filtered based on your role. You see evidence submissions that are relevant to your function domain. Admin and Tech Lead see all evidence across the system.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Override Workflow',
        slug: 'override-workflow',
        summary: 'When and how to use admin overrides, audit trail, and who has override access.',
        content: doc(
          p('Sometimes the normal approval flow is not sufficient — an urgent task needs to be marked done without standard evidence review, or a decision needs to bypass the consensus process. The override workflow exists for these situations.'),
          h2('When to Use Overrides'),
          ul(
            li('Emergency situations where waiting for standard approval would cause harm'),
            li('Tasks where evidence cannot be provided in the standard format'),
            li('Correcting an incorrect rejection that cannot be reversed through normal flow'),
          ),
          h2('How to Override'),
          ol(
            li('Navigate to the Approvals page'),
            li('Find the evidence or approval item that needs an override'),
            li('Click "Override" (only visible to users with MANAGE_SYSTEM permission)'),
            li('Enter a detailed reason for the override — this is mandatory and recorded in the audit trail'),
            li('Confirm the override'),
          ),
          h2('Who Can Override'),
          p('Only the Founder/Admin role can execute overrides. The system enforces this with a role check — even if another role has the MANAGE_SYSTEM permission, the override endpoint specifically requires the FOUNDER_ADMIN role code.'),
          h2('Audit Trail'),
          p('Every override is permanently recorded with: who overrode, when, the reason provided, and which item was affected. This ensures accountability and provides a complete governance history. Overrides should be rare — if they become frequent, review whether the standard approval process needs adjustment.'),
        ),
        sort_order: 3,
        status: 'published',
      },
    ],
  },

  // ── Section 7: Governance & Decisions (3 pages) ───────────
  {
    title: 'Governance & Decisions',
    slug: 'governance-decisions',
    description: 'Decision logging, creating decisions with context and stakeholders, and managing blockers.',
    icon: 'Scale',
    accent_color: '#0EA5E9',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'FRONTEND_LEAD', 'BACKEND_LEAD', 'BI_LEAD', 'DESIGN_OUTREACH_LEAD'],
    sort_order: 7,
    status: 'published',
    pages: [
      {
        title: 'The Decision Log',
        slug: 'decision-log',
        summary: 'What decisions are tracked, their statuses, and how to browse and filter the decision list.',
        content: doc(
          p('The decision log captures all significant team decisions with their context, rationale, and outcome. This creates an institutional memory that prevents re-debating resolved issues and provides context for new team members.'),
          h2('Decision Statuses'),
          ul(
            liBold('Proposed', ' — a new decision has been submitted for discussion. Stakeholders should review and provide input'),
            liBold('Approved', ' — the decision has been approved by the relevant authority (based on the governance tier)'),
            liBold('Rejected', ' — the proposed decision was rejected. The reason is recorded for context'),
            liBold('Deferred', ' — decision is put on hold. This is different from rejected — it may be revisited later'),
          ),
          h2('Browsing Decisions'),
          p('Navigate to Decisions from the sidebar. The page shows a paginated list of all decisions, newest first. You can filter by status using the status dropdown to see only proposed, approved, rejected, or deferred decisions.'),
          h2('Decision Detail'),
          p('Click any decision to see its full details: title, decision type, context, linked mission or task, who proposed it, and the resolution. Approved and rejected decisions include the reviewer and their notes.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Creating a Decision',
        slug: 'creating-a-decision',
        summary: 'Decision form fields, decision types, and linking decisions to missions and tasks.',
        content: doc(
          p('Anyone with the CREATE_DECISION permission can log a decision. This captures the "why" behind choices and ensures cross-functional visibility.'),
          h2('Creating a New Decision'),
          ol(
            li('Navigate to the Decisions page'),
            li('Click "Create Decision"'),
            li('Fill in the required fields: title and context'),
            li('Select the decision type'),
            li('Optionally link the decision to a specific mission or task'),
            li('Submit — the decision enters "proposed" status'),
          ),
          h2('Decision Types'),
          ul(
            liBold('Individual', ' — within one person\'s domain of authority (Tier 1 governance). Example: choosing a specific recipe technique'),
            liBold('Cross-function', ' — affects multiple roles or domains (Tier 2). Requires the 2+1 rule: two relevant roles plus one impacted role. Example: pricing changes that affect both BI and Frontend'),
            liBold('Strategic', ' — high-impact organizational decisions (Tier 3). Requires founder/admin sign-off. Example: adding a new sales channel, major budget allocation'),
          ),
          h2('Linking to Missions and Tasks'),
          p('When a decision relates to a specific mission or task, link it using the optional mission_id and task_id fields. This creates traceability — you can later understand which decisions influenced which work items.'),
          h2('Approval Process'),
          p('Decisions in "proposed" status can be updated by users with APPROVE_DECISION permission. They can change the status to approved, rejected, or deferred, and add resolution notes explaining the outcome.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Managing Blockers',
        slug: 'managing-blockers',
        summary: 'How blocked tasks surface on the admin dashboard, escalation, and resolution tracking.',
        content: doc(
          p('Blockers are tasks that cannot progress due to external dependencies, resource constraints, or unresolved issues. The system makes blockers visible to leadership so they can be resolved quickly.'),
          h2('How Blockers Work'),
          ol(
            li('Any team member can block their own task by clicking "Block" on the task detail page'),
            li('They must enter a reason explaining what is blocking progress'),
            li('The task status changes to "blocked" and appears in the admin dashboard\'s Blockers widget'),
          ),
          h2('The Admin Blockers Widget'),
          p('On the Mission Control dashboard (admin view), the Blockers widget shows all currently blocked tasks across the team. Each entry shows the task title, who it is assigned to, and the blocking reason. This gives the admin immediate visibility into what needs attention.'),
          h2('Resolving Blockers'),
          ol(
            li('Admin reviews the blocked task and takes action (e.g., communicates with vendors, reallocates resources, makes a decision)'),
            li('Once the blocker is resolved, the task assignee or admin clicks "Unblock"'),
            li('The task returns to its previous status (in_progress) and work can resume'),
          ),
          h2('Escalation'),
          p('Persistent blockers that cannot be resolved at the team level should be escalated as a strategic decision using the Decision Log. Create a decision of type "strategic" linking to the blocked task, so it receives founder/admin attention with full context.'),
        ),
        sort_order: 3,
        status: 'published',
      },
    ],
  },

  // ── Section 8: Analytics & Dashboard (3 pages) ────────────
  {
    title: 'Analytics & Dashboard',
    slug: 'analytics-dashboard',
    description: 'The admin dashboard layout, analytics reports for revenue and costs, and KPI tracking.',
    icon: 'BarChart3',
    accent_color: '#14B8A6',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'BI_LEAD'],
    sort_order: 8,
    status: 'published',
    pages: [
      {
        title: 'Dashboard Overview',
        slug: 'dashboard-overview',
        summary: 'The admin Mission Control dashboard — action zone, status zone, and intelligence zone.',
        content: doc(
          p('The dashboard is the first page you see after logging in. It adapts based on your role: admin users see "Mission Control" with full system visibility, while other roles see "My Dashboard" focused on their own tasks and contributions.'),
          h2('Admin Dashboard: Mission Control'),
          p('The admin dashboard is organized into three zones:'),
          h3('Action Required Zone'),
          ul(
            li('Pending Approvals widget — shows evidence items awaiting your review'),
            li('Blockers widget — lists all blocked tasks across the team with reasons'),
            li('Ad-hoc Injector widget — quick form to create urgent tasks without navigating away'),
            li('KPI Alerts — highlights KPIs that are behind target'),
          ),
          h3('Status Zone'),
          ul(
            li('Readiness Strip — circular progress indicators for each of the 10 readiness meters (Villa, Backend, Frontend, Procurement, etc.)'),
            li('Recent Decisions — latest decision log entries for quick context'),
          ),
          h3('Intelligence Zone'),
          ul(
            li('Leaderboard Preview — top team members by XP without navigating to the full page'),
            li('Low Stock Alerts — ingredients below minimum stock level with current vs minimum quantities'),
          ),
          h2('Role Dashboard'),
          p('Non-admin users see a personalized dashboard showing their assigned tasks, quest progress, evidence status, and contribution metrics. The "View As" dropdown in the admin dashboard allows admins to see the system from any user\'s perspective.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Analytics Reports',
        slug: 'analytics-reports',
        summary: 'Revenue trends, channel breakdown, recipe cost analysis, and top items reports.',
        content: doc(
          p('The Analytics page provides data-driven insights into the business. It is accessible to users with the MANAGE_KPIS permission (Admin, Tech Lead, BI Lead).'),
          h2('Available Reports'),
          h3('Revenue Series'),
          p('A time-series chart showing daily or weekly revenue over a selected date range. Use this to identify trends, peak days, and slow periods.'),
          h3('Channel Breakdown'),
          p('Revenue and order count split by sales channel (Dine-in, Delivery, Takeaway, etc.). Helps understand which channels drive the most business.'),
          h3('Recipe Costs'),
          p('A table showing each recipe with its ingredient cost, portion cost, and food cost percentage. Sorted to highlight recipes with the highest food cost ratios. This is essential for pricing decisions.'),
          h3('Top Items'),
          p('The most-ordered menu items within the date range, ranked by quantity sold. Identifies bestsellers for menu optimization.'),
          h3('Summary'),
          p('A high-level summary with total revenue, total orders, average order value, and top-level metrics for the selected period.'),
          h2('Date Range Filtering'),
          p('All reports support a from/to date range filter. Set the dates to analyze specific periods — useful for comparing week-over-week or month-over-month performance.'),
          h3('Wins Feed'),
          p('The analytics wins feed shows significant positive events (e.g., record-breaking sales day, all KPIs on track). It uses cursor-based pagination for efficient scrolling through history.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'Working with KPIs',
        slug: 'working-with-kpis',
        summary: 'Creating KPIs, domain categories, tracking progress, and alerts when behind target.',
        content: doc(
          p('KPIs (Key Performance Indicators) are measurable goals tied to specific business domains. The KPI Tracker page lets you create, monitor, and update KPIs across the organization.'),
          h2('KPI Page Layout'),
          p('The KPIs page shows cards in a grid. Each card displays the KPI name, domain, target vs actual values with a progress bar, status badge (on_track, at_risk, behind), and the last updated date. Domain filter tabs at the top let you view KPIs by area.'),
          h2('Creating a KPI'),
          ol(
            li('Click "Create KPI" (requires MANAGE_KPIS permission)'),
            li('Enter the KPI name (e.g., "Weekly Revenue Target")'),
            li('Set the target value and unit (e.g., 50000 INR)'),
            li('Select the domain (food, procurement, sales, tech, etc.)'),
            li('Optionally link contributing tasks that drive this KPI'),
            li('Save — the KPI appears with "behind" status until actual values are recorded'),
          ),
          h2('Updating KPI Progress'),
          p('Click the edit button on a KPI card to update the actual value. The system automatically calculates the percentage complete and assigns a status:'),
          ul(
            liBold('On Track', ' — actual is 80% or more of target'),
            liBold('At Risk', ' — actual is between 50% and 80% of target'),
            liBold('Behind', ' — actual is below 50% of target'),
          ),
          h2('Dashboard Alerts'),
          p('KPIs that are "at_risk" or "behind" appear in the admin dashboard\'s Action Required zone as KPI Alert cards. This ensures leadership sees performance issues without needing to visit the KPIs page.'),
        ),
        sort_order: 3,
        status: 'published',
      },
    ],
  },

  // ── Section 9: Notifications (2 pages) ────────────────────
  {
    title: 'Notifications',
    slug: 'notifications',
    description: 'How the notification system works — types, real-time alerts, and managing your notification inbox.',
    icon: 'Bell',
    accent_color: '#F97316',
    role_codes: ALL_ROLES,
    sort_order: 9,
    status: 'published',
    pages: [
      {
        title: 'How Notifications Work',
        slug: 'how-notifications-work',
        summary: 'Notification types, real-time bell icon count, and the notification list page.',
        content: doc(
          p('The notification system keeps you informed about events that need your attention. Notifications are created automatically when specific actions occur in the system.'),
          h2('Notification Types'),
          ul(
            liBold('Task Due', ' — a task assigned to you is approaching its deadline'),
            liBold('Task Blocked', ' — a task you own or manage has been blocked by someone'),
            liBold('Approval Pending', ' — evidence submitted for a task is waiting for your review'),
            liBold('Low Stock', ' — an ingredient has fallen below its minimum stock level'),
            liBold('New Order', ' — a new order has been placed (for kitchen staff)'),
            liBold('Order Ready', ' — all items in an order are prepared (for front-of-house)'),
            liBold('Delivery Update', ' — a delivery order status has changed'),
          ),
          h2('Real-Time Bell Icon'),
          p('The bell icon in the navigation bar shows your unread notification count. This count updates when you receive new notifications. Click the bell to navigate to the full notifications page.'),
          h2('Cooldown System'),
          p('To avoid notification fatigue, the system uses a cooldown mechanism. If the same type of notification for the same reference (e.g., the same low-stock ingredient) was sent recently, a new one is suppressed until the cooldown period expires. This prevents your inbox from filling with duplicate alerts.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Managing Your Notifications',
        slug: 'managing-notifications',
        summary: 'Marking as read, filtering by category, and the "Mark all as read" action.',
        content: doc(
          p('The Notifications page is your central inbox for all system alerts. It is designed to help you quickly find and act on what matters.'),
          h2('Notification Tabs'),
          p('The page has five filter tabs across the top:'),
          ul(
            liBold('All', ' — every notification'),
            liBold('Unread', ' — only notifications you have not yet read'),
            liBold('Tasks', ' — task deadline and blocker alerts'),
            liBold('Approvals', ' — approval pending notifications'),
            liBold('Operations', ' — stock, order, and delivery notifications'),
          ),
          h2('Marking as Read'),
          ul(
            li('Click on any notification item to navigate to its linked content (e.g., clicking a task notification opens that task). The notification is marked as read automatically'),
            li('Use the "Mark all as read" button at the top to clear all unread notifications in one click'),
          ),
          h2('Pagination'),
          p('Notifications load in pages of 20 items. Scroll to the bottom and click "Load more notifications" to fetch older entries. The system uses cursor-based pagination for efficient loading.'),
          h2('Empty States'),
          p('When a tab has no notifications, a helpful message explains what would appear there. For example, the Unread tab shows "All caught up" when there are no unread notifications, and the Tasks tab explains "Task deadline and blocker alerts will appear here."'),
        ),
        sort_order: 2,
        status: 'published',
      },
    ],
  },

  // ── Section 10: Events & Bookings (3 pages) ───────────────
  {
    title: 'Events & Bookings',
    slug: 'events-bookings',
    description: 'Creating experience events, managing guest bookings, capacity tracking, and the public event page.',
    icon: 'Calendar',
    accent_color: '#D946EF',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'FRONTEND_LEAD', 'DESIGN_OUTREACH_LEAD'],
    sort_order: 10,
    status: 'published',
    pages: [
      {
        title: 'Creating Events',
        slug: 'creating-events',
        summary: 'Event form fields, event types, and publishing events to the public page.',
        content: doc(
          p('Events are curated experiences hosted at the villa — from dinner experiences and workshops to pop-up events and tastings. The Events page lets you create, edit, and manage them.'),
          h2('Creating an Event'),
          ol(
            li('Navigate to Operations > Events'),
            li('Click "Create Event"'),
            li('Fill in the Event Form that opens as a slide-in sheet:'),
          ),
          ul(
            liBold('Title', ' — the event name shown to guests (3-200 characters)'),
            liBold('Event Type', ' — choose from: Dining, Workshop, Pop-up, Tasting, or Other'),
            liBold('Date', ' — when the event takes place'),
            liBold('Capacity', ' — maximum number of guests (minimum 1)'),
            liBold('Price', ' — ticket price in INR (can be 0 for free events)'),
            liBold('Zone', ' — optional venue zone within the villa (Garden Terrace, Dining Hall, etc.)'),
            liBold('Brand', ' — optional brand association (Konma Food or Just Craves)'),
            liBold('Description', ' — detailed event description (up to 2000 characters)'),
            liBold('Image URL', ' — optional cover image for the event card'),
          ),
          h2('Event Table'),
          p('After creation, the event appears in the events table with columns for title, date, type, status, capacity, bookings count, and action buttons (edit, view bookings, delete).'),
          h2('Publishing'),
          p('Created events are immediately visible on the public /events page (no authentication required). Guests browsing the website can see upcoming events and book directly.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Managing Bookings',
        slug: 'managing-bookings',
        summary: 'Viewing the booking list, capacity tracking, and guest information for each event.',
        content: doc(
          p('When guests book an event through the public page, their booking appears in the event\'s booking list. This page covers how to manage and review these bookings.'),
          h2('Viewing Bookings'),
          ol(
            li('Go to Operations > Events'),
            li('Find the event in the table'),
            li('Click the "View Bookings" button in the Actions column'),
            li('A slide-in sheet opens showing all bookings for that event'),
          ),
          h2('Booking Information'),
          p('Each booking record includes:'),
          ul(
            liBold('Customer Name', ' — the name provided during booking'),
            liBold('Customer Phone', ' — contact number (5-20 characters)'),
            liBold('Guests', ' — number of guests in this booking (1-50)'),
            liBold('Booking Date', ' — when the booking was made'),
            liBold('Status', ' — CONFIRMED by default'),
          ),
          h2('Capacity Tracking'),
          p('The events table shows the booking count alongside the capacity for each event. When total booked guests reach the capacity limit, new bookings are automatically prevented by the system. The public event page shows availability badges so guests know before attempting to book.'),
          h2('Rate Limiting'),
          p('The booking endpoint is rate-limited to 5 bookings per 5 minutes per IP address. This prevents abuse while allowing legitimate customers to book.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'The Public Event Page',
        slug: 'public-event-page',
        summary: 'How the public /events page works for customers — event cards, availability, and the booking form.',
        content: doc(
          p('The public events page is accessible without logging in at the /events URL. It shows upcoming events and allows guests to book directly.'),
          h2('What Guests See'),
          p('The public page displays a list of upcoming events (past events are filtered out). Each event card shows:'),
          ul(
            li('Event title and description'),
            li('Date and time'),
            li('Event type (Dining, Workshop, etc.)'),
            li('Price per person'),
            li('Capacity and remaining spots'),
            li('Cover image if one was provided'),
          ),
          h2('Booking Flow for Guests'),
          ol(
            li('Guest browses the events page — no login required'),
            li('Clicks on an event to see its full details'),
            li('Enters their name, phone number, and number of guests'),
            li('Submits the booking'),
            li('Receives a confirmation (the booking is immediately visible to staff in the admin panel)'),
          ),
          h2('Availability Badges'),
          p('Events approaching capacity show an availability indicator. When fully booked, the booking form is disabled and a "Sold Out" badge appears. This is calculated in real-time from confirmed booking counts against the event capacity.'),
          h2('Rate Limiting'),
          p('Public endpoints are rate-limited (30 requests per minute for browsing, 5 per 5 minutes for booking) to protect against abuse while keeping the experience fast for legitimate users.'),
        ),
        sort_order: 3,
        status: 'published',
      },
    ],
  },

  // ── Section 11: Customer Feedback (2 pages) ───────────────
  {
    title: 'Customer Feedback',
    slug: 'customer-feedback',
    description: 'How the feedback system works — customer submission via public links and staff review of ratings and comments.',
    icon: 'MessageSquare',
    accent_color: '#EF4444',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD', 'FRONTEND_LEAD'],
    sort_order: 11,
    status: 'published',
    pages: [
      {
        title: 'How Feedback Works',
        slug: 'how-feedback-works',
        summary: 'Customer-facing feedback form, star ratings, and the submission flow.',
        content: doc(
          p('Customer feedback is collected through a public form that requires no login. Feedback can be linked to specific orders (via the order QR code) or submitted independently.'),
          h2('Customer Submission'),
          ol(
            li('The customer receives a feedback link — either via a QR code printed on the receipt or a direct URL'),
            li('The link opens a simple form with a star rating (1 to 5 stars) and an optional text comment (up to 2000 characters)'),
            li('The customer can optionally provide their name and phone number'),
            li('If the link includes an order ID, the feedback is automatically linked to that order'),
            li('They submit the form — a thank-you confirmation appears'),
          ),
          h2('Star Rating Scale'),
          ul(
            li('1 star — Very poor experience'),
            li('2 stars — Below expectations'),
            li('3 stars — Average, meets basic expectations'),
            li('4 stars — Good experience'),
            li('5 stars — Excellent, exceeded expectations'),
          ),
          h2('QR Code Integration'),
          p('Each order has a QR code endpoint that generates a link to the feedback form with the order ID pre-filled. Print this QR code on receipts or display it at the table to encourage feedback.'),
          h2('Rate Limiting'),
          p('The feedback endpoint allows 5 submissions per 5 minutes per IP address to prevent spam while allowing genuine customer feedback.'),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Reviewing Feedback',
        slug: 'reviewing-feedback',
        summary: 'The feedback list page, stats card, and filtering by rating and date range.',
        content: doc(
          p('The internal Feedback page shows all submitted feedback with tools to filter, analyze, and identify trends.'),
          h2('Feedback Stats Card'),
          p('At the top of the page, the stats card shows aggregate metrics: total feedback count, average rating, and distribution across star levels. This gives you an at-a-glance picture of customer satisfaction.'),
          h2('Filtering'),
          p('Two filter controls sit below the stats:'),
          ul(
            liBold('Rating Filter Tabs', ' — click a star level (1-5) to show only feedback with that rating, or "All" to see everything'),
            liBold('Date Range Dropdown', ' — filter by "Today", "This Week", "This Month", or "All Time"'),
          ),
          h2('Feedback Table'),
          p('The table shows each feedback entry with columns for:'),
          ul(
            li('Rating (displayed as star icons)'),
            li('Comment text'),
            li('Customer name (if provided)'),
            li('Linked order (short ID)'),
            li('Submission date'),
          ),
          h2('Acting on Feedback'),
          ul(
            li('Low ratings (1-2 stars) should be reviewed immediately to identify service issues'),
            li('Comments provide qualitative insight that star ratings alone cannot capture'),
            li('Look for patterns — if multiple customers mention the same issue, it signals a systemic problem'),
            li('Use the linked order ID to investigate specific order details when feedback relates to an order'),
          ),
          h2('Empty State'),
          p('When no feedback has been submitted yet, the page shows: "Feedback submitted via QR codes and links will appear here." Share feedback links with customers to start collecting data.'),
        ),
        sort_order: 2,
        status: 'published',
      },
    ],
  },

  // ── Section 12: Admin & System Guide (4 pages) ────────────
  {
    title: 'Admin & System Guide',
    slug: 'admin-system-guide',
    description: 'User management, the permission matrix, system settings, and approval delegations.',
    icon: 'Shield',
    accent_color: '#64748B',
    role_codes: ['FOUNDER_ADMIN', 'TECH_LEAD'],
    sort_order: 12,
    status: 'published',
    pages: [
      {
        title: 'User Management',
        slug: 'user-management',
        summary: 'Creating users, assigning roles, password resets, and deactivating accounts.',
        content: doc(
          p('The Team page under Admin lets you manage all user accounts in the system. Only users with MANAGE_RBAC permission can access this page.'),
          h2('User List'),
          p('The page displays a table with columns: Name (with avatar initials), Email, Role (as a badge), Status (active/suspended), Last Active, and an actions menu. Each row represents one team member.'),
          h2('Creating a New User'),
          ol(
            li('Click "Add team member" in the top-right corner'),
            li('The Create User dialog opens'),
            li('Enter the user\'s name and email address'),
            li('Select their role from the dropdown (one of the 8 roles)'),
            li('Click Create — the user receives a temporary password and can log in immediately'),
          ),
          h2('Password Resets'),
          p('Click the three-dot menu on a user row and select "Send password reset email". This triggers a password reset flow. The user receives an email with instructions to set a new password.'),
          h2('Deactivating Users'),
          p('To remove access: click the three-dot menu and select "Deactivate user". A confirmation dialog appears explaining the consequences. Deactivated users lose access immediately but can be reactivated later. Their XP, task history, and evidence are preserved.'),
          h2('Important Notes'),
          ul(
            li('Each user is assigned exactly one role. Changing roles requires updating the user record'),
            li('The Admin account cannot be deactivated'),
            li('User status is either "active" or "suspended" — there is no deletion, only deactivation'),
          ),
        ),
        sort_order: 1,
        status: 'published',
      },
      {
        title: 'Roles & Permissions',
        slug: 'roles-permissions',
        summary: 'Understanding the 8 roles, the permission matrix, and how role_codes control guide visibility.',
        content: doc(
          p('The system has 8 predefined roles, each with a specific set of permissions. The Permissions page shows a matrix of all roles and their permissions.'),
          h2('The 8 Roles'),
          ul(
            liBold('Founder/Admin', ' — full system access, all permissions, override capability'),
            liBold('Tech Lead', ' — full system access for technical administration'),
            liBold('Backend Lead', ' — food production, R&D, standardization, quality'),
            liBold('Frontend Lead', ' — customer flow, service, beverage, channels'),
            liBold('BI Lead', ' — costing, pricing, KPIs, performance analytics'),
            liBold('Procurement Lead', ' — vendors, sourcing, inventory, kitchen'),
            liBold('Talent Lead', ' — onboarding, training, hiring pipeline'),
            liBold('Design/Outreach Lead', ' — brand identity, storytelling, events'),
          ),
          h2('Permission Matrix'),
          p('The Permissions page displays a grid with roles as columns and permissions as rows. Each cell shows whether that role has that permission. Changes to the matrix take effect within 60 seconds (the permission cache refresh interval).'),
          h2('Key Permissions'),
          ul(
            liBold('VIEW_ALL', ' — see data across all users (Admin and Tech Lead only)'),
            liBold('VIEW_ROLE_SCOPED', ' — see only data relevant to your own role'),
            liBold('MANAGE_RBAC', ' — change role permissions and manage users'),
            liBold('MANAGE_SYSTEM', ' — access system settings, overrides'),
            liBold('MANAGE_GUIDE', ' — create and edit guide sections and pages'),
          ),
          h2('Guide Visibility'),
          p('Each guide section has a role_codes array. When a non-admin user opens the Guide, they only see sections where their role code is included in the array. Admin and Tech Lead bypass this filter and see all sections. This ensures each team member sees only the guides relevant to their function.'),
        ),
        sort_order: 2,
        status: 'published',
      },
      {
        title: 'System Settings',
        slug: 'system-settings',
        summary: 'Leaderboard toggle, system configuration, and managing brands, channels, and zones.',
        content: doc(
          p('The System Settings page provides administrative controls for system-wide configuration. It is accessible only to users with MANAGE_SYSTEM permission.'),
          h2('Leaderboard Toggle'),
          p('The primary setting is the leaderboard enable/disable switch. When toggled off, rankings are hidden from all users, but XP and levels continue to accumulate silently. Turning it back on reveals updated rankings.'),
          ul(
            li('Toggling OFF requires confirmation via a dialog: "Disable leaderboard? Users will no longer see rankings."'),
            li('Toggling ON takes effect immediately without confirmation'),
            li('The setting is stored in the system_settings table as a key-value pair'),
          ),
          h2('Brands'),
          p('The system ships with two seeded brands: Konma Food and Just Craves. Both are active food brands. Brands organize recipes, menu items, and categories. The POS and Menu pages filter by brand.'),
          h2('Channels'),
          p('Seven sales channels are seeded: Dine-in, Delivery, Takeaway, Retail, Event, Workshop, and Online. Channels affect order routing and pricing (via channel modifiers). All channels start in "planned" status.'),
          h2('Zones'),
          p('Eight zones represent physical areas in the villa: Main Kitchen, Prep Station, Dining Hall, Garden Terrace, Workshop Studio, Cold Storage, Office, and Lounge. Zones are used in inventory tracking (which zone holds stock), prep batch assignment, and event location.'),
        ),
        sort_order: 3,
        status: 'published',
      },
      {
        title: 'Delegations',
        slug: 'delegations',
        summary: 'Creating approval delegations, time-limited permission transfer, and use cases.',
        content: doc(
          p('Approval delegations allow a user\'s approval authority to be temporarily transferred to another user. This is essential for covering absences without blocking the approval workflow.'),
          h2('The Delegations Page'),
          p('Navigate to Admin > Delegations (only accessible to the Founder/Admin role). The page shows a list of all delegations with from/to users, start/end dates, and active status. A "Create Delegation" button opens the form.'),
          h2('Creating a Delegation'),
          ol(
            li('Click "Create Delegation"'),
            li('Select the "From" user — the person whose approval authority will be delegated'),
            li('Select the "To" user — the person who will temporarily gain that authority'),
            li('Set the start date and end date for the delegation period'),
            li('Click Create — the delegation is immediately active if the start date is today or earlier'),
          ),
          h2('How Delegations Work'),
          ul(
            li('When a user with an active delegation approves an evidence item, the system checks the delegation chain'),
            li('The approval is recorded with both the acting user and the delegation reference'),
            li('A user cannot delegate to themselves — the system prevents this'),
            li('End date must be on or after start date'),
            li('Multiple delegations can coexist, but only active ones within the current date range are used'),
          ),
          h2('Deactivating Delegations'),
          p('If a delegation needs to be ended early, use the deactivate action on the delegation list. This immediately revokes the transferred authority without waiting for the end date.'),
          h2('Use Cases'),
          ul(
            li('Team member on leave — delegate their approval authority to a colleague'),
            li('Temporary cross-function support — allow a team member to approve in another domain during a busy period'),
            li('Training — let a new team member practice approvals under supervision with a time-limited delegation'),
          ),
        ),
        sort_order: 4,
        status: 'published',
      },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

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

    // Upsert users (one per role, per-user password)
    for (const seed of ROLE_SEEDS) {
      const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);
      await tx.user.upsert({
        where: { email: seed.userEmail },
        update: {
          name: seed.userName,
          role_id: roleRecords[seed.code],
          function: seed.functionDomain,
          password_hash: passwordHash,
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

    for (const section of guideSections) {
      const { pages, ...sectionData } = section;
      const created = await tx.guideSection.create({ data: sectionData });
      for (const page of pages) {
        await tx.guidePage.create({
          data: { ...page, section_id: created.id, estimated_read_time: computeReadTime(page.content) },
        });
      }
    }
  }, { timeout: 30000 });

  console.log('Seed completed successfully!');
  console.log(`  - ${ROLE_SEEDS.length} roles`);
  console.log(`  - ${ROLE_SEEDS.length} users (one per role)`);
  console.log(`  - ${READINESS_METERS.length} readiness meters`);
  console.log('  - 1 system setting (leaderboard_enabled)');
  console.log(`  - ${ZONES.length} zones`);
  console.log(`  - ${BRANDS.length} brands`);
  console.log(`  - ${CHANNELS.length} channels`);
  console.log(`  - ${UNIT_CONVERSIONS.length} unit conversions`);
  console.log('  - 12 guide sections with 39+ pages');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
