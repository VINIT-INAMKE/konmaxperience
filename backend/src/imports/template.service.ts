import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { IMPORT_TYPE_CONFIG, type ImportType } from './import-types';

const SAMPLE_DATA: Record<ImportType, Record<string, string>> = {
  ingredients: {
    name: 'Tomatoes',
    category: 'Vegetables',
    base_unit: 'kg',
    min_stock_level: '5',
  },
  vendors: {
    name: 'Fresh Farms Ltd',
    phone: '+91-9876543210',
    email: 'info@freshfarms.in',
    address: '123 Market Rd, Mumbai',
    payment_terms: 'Net 30',
    status: 'active',
  },
  vendor_pricing: {
    vendor: 'Fresh Farms Ltd',
    ingredient: 'Tomatoes',
    price: '45.50',
    unit: 'kg',
    effective_date: '2026-01-15',
  },
  opening_stock: {
    ingredient: 'Basmati Rice',
    zone: 'Main Kitchen',
    zone_id: '',
    quantity: '5000',
    unit: 'g',
    reason: 'Opening stock',
  },
  missions: {
    title: 'Foundation Setup',
    description:
      'Establish core villa kitchen operations, procurement, and inventory systems',
    phase: 'foundation',
    scope: 'food',
    start_date: '2026-04-01',
    end_date: '2026-06-30',
  },
  quests: {
    title: 'Week 1 Kitchen Setup',
    description:
      'Set up all kitchen stations, equipment checks, and initial inventory',
    mission: 'Foundation Setup',
    week_number: '1',
    owner_email: 'admin@konma.store',
    start_date: '2026-04-01',
    end_date: '2026-04-07',
  },
  tasks: {
    title: 'Organize prep station',
    description:
      'Set up cutting boards, knife sets, and prep containers at each station',
    mission: 'Foundation Setup',
    quest: 'Week 1 Kitchen Setup',
    owner_email: 'admin@konma.store',
    task_type: 'core',
    domain: 'food',
    priority: 'high',
    xp: '30',
    due_date: '2026-04-03',
    readiness_meter: 'Kitchen Readiness',
    kpi: 'Food Cost Percentage',
    depends_on: '',
    requires_approval: 'true',
  },
  kpis: {
    name: 'Food Cost Percentage',
    description: 'Track food cost as percentage of total revenue',
    unit: '%',
    target_value: '30',
    domain: 'food',
    current_value: '0',
    status: 'on_track',
  },
  events: {
    title: 'Farm to Table Dinner',
    event_type: 'dining',
    date: '2026-04-15T19:00:00',
    capacity: '30',
    price: '2500',
    zone: 'Garden Terrace',
    brand: 'Konma Food',
    description:
      'A seasonal five-course dinner featuring produce from our partner farms',
  },
  recipes: {
    name: 'Dal Tadka',
    description: 'Comfort yellow dal with ghee tempering',
    prep_steps:
      '1. Soak toor dal 2 hrs 2. Pressure cook 4 whistles 3. Prepare tadka with ghee, cumin, garlic',
    cooking_method: 'Pressure cook + tadka',
    yield_qty: '4',
    yield_unit: 'portions',
    portion_size: '250g',
    shelf_life_hours: '48',
    brand: 'Konma Food',
    zone: 'Main Kitchen',
  },
  menu_categories: {
    name: 'Mains',
    brand: 'Konma Food',
    sort_order: '1',
  },
  menu_items: {
    name: 'Dal Tadka Bowl',
    recipe: 'Dal Tadka',
    category: 'Mains',
    brand: 'Konma Food',
    base_price: '350',
    available: 'true',
  },
  purchase_orders: {
    vendor: 'Fresh Farms Ltd',
    zone: 'Main Kitchen',
    status: 'draft',
    notes: 'Weekly vegetable order',
    linked_task: '',
  },
};

const INSTRUCTIONS: Record<ImportType, string[][]> = {
  ingredients: [
    ['Field Name', 'Required', 'Type', 'Description'],
    [
      'name',
      'Yes',
      'Text',
      'Ingredient name (used for duplicate detection)',
    ],
    [
      'category',
      'Yes',
      'Text',
      'Ingredient category name — must match an existing category (e.g. Vegetables, Dairy, Spices (dried))',
    ],
    [
      'base_unit',
      'Yes',
      'Text',
      'Base measurement unit — valid values: g, ml, pieces, kg, L, dozen, tray, packet, bunch, can, bottle, oz, lb',
    ],
    [
      'min_stock_level',
      'Yes',
      'Number',
      'Minimum stock level (decimal allowed, e.g., 5 or 2.5)',
    ],
  ],
  vendors: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'Vendor name (used for duplicate detection)'],
    ['phone', 'No', 'Text', 'Contact phone number'],
    ['email', 'No', 'Text', 'Contact email address'],
    ['address', 'No', 'Text', 'Business address'],
    ['payment_terms', 'No', 'Text', 'Payment terms (e.g., Net 30, COD)'],
    ['status', 'No', 'Text', 'active or inactive (defaults to active)'],
  ],
  vendor_pricing: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['vendor', 'Yes', 'Text', 'Vendor name (must exist in system)'],
    ['ingredient', 'Yes', 'Text', 'Ingredient name (must exist in system)'],
    ['price', 'Yes', 'Number', 'Unit price (decimal, e.g., 45.50)'],
    ['unit', 'Yes', 'Text', 'Price unit (e.g., kg, g, L, pcs)'],
    [
      'effective_date',
      'Yes',
      'Date',
      'Price effective date (YYYY-MM-DD format)',
    ],
  ],
  opening_stock: [
    ['Field Name', 'Required', 'Type', 'Description'],
    [
      'ingredient',
      'Yes',
      'Text',
      'Must match an existing ingredient name exactly',
    ],
    [
      'zone',
      'Yes*',
      'Text',
      'Must match an existing zone name. * Not required if zone_id is provided',
    ],
    [
      'zone_id',
      'No',
      'UUID',
      'Optional fallback — overrides zone name if both provided',
    ],
    [
      'quantity',
      'Yes',
      'Number',
      'Opening quantity (must be positive). Stock imports are ADDITIVE.',
    ],
    [
      'unit',
      'Yes',
      'Text',
      'Must have conversion path to ingredient base_unit. Safe values: g, kg, ml, L, pieces, dozen',
    ],
    ['reason', 'No', 'Text', 'Defaults to "Opening stock" if blank'],
    ['', '', '', ''],
    [
      'WARNING',
      '',
      '',
      'Stock imports are ADDITIVE. If you import this file twice, quantities will be doubled.',
    ],
    [
      'TIP',
      '',
      '',
      'Available zones: Main Kitchen, Prep Station, Dining Hall, Garden Terrace, Workshop Studio, Cold Storage, Office, Lounge',
    ],
  ],
  missions: [
    ['Field Name', 'Required', 'Type', 'Description'],
    [
      'title',
      'Yes',
      'Text',
      'Mission title (min 3 chars). Used for duplicate detection.',
    ],
    ['description', 'Yes', 'Text', 'Mission description'],
    [
      'phase',
      'Yes',
      'Enum',
      'Valid values: setup, foundation, activation, scale',
    ],
    [
      'scope',
      'Yes',
      'Enum',
      'Valid values: food, art, lifestyle, system, mixed',
    ],
    ['start_date', 'No', 'Date', 'YYYY-MM-DD format'],
    ['end_date', 'No', 'Date', 'YYYY-MM-DD format'],
    ['', '', '', ''],
    [
      'NOTE',
      '',
      '',
      'Missions are created with status "planned". Progress is calculated automatically from tasks.',
    ],
  ],
  quests: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['title', 'Yes', 'Text', 'Quest title (min 3 chars)'],
    ['description', 'Yes', 'Text', 'Quest description'],
    ['mission', 'Yes', 'Text', 'Must match an existing mission title'],
    ['week_number', 'Yes', 'Integer', 'Week number >= 1'],
    ['owner_email', 'Yes', 'Email', 'Must match a registered user email'],
    ['start_date', 'No', 'Date', 'YYYY-MM-DD format'],
    ['end_date', 'No', 'Date', 'YYYY-MM-DD format'],
    ['', '', '', ''],
    [
      'NOTE',
      '',
      '',
      'Quests are created with status "planned". Import ALL tasks for a quest BEFORE activating it — baseline task count locks on first activation.',
    ],
  ],
  tasks: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['title', 'Yes', 'Text', 'Task title (min 3 chars)'],
    ['description', 'Yes', 'Text', 'Task description'],
    ['mission', 'Yes', 'Text', 'Must match an existing mission title'],
    [
      'quest',
      'No',
      'Text',
      'Must match a quest title within the specified mission. Leave blank for mission-level tasks.',
    ],
    ['owner_email', 'Yes', 'Email', 'Must match a registered user email'],
    ['task_type', 'Yes', 'Enum', 'Valid values: core, adhoc, improvement'],
    [
      'domain',
      'Yes',
      'Enum',
      'Valid values: food, art, lifestyle, ops, procurement, bi, talent, tech, design',
    ],
    [
      'priority',
      'Yes',
      'Enum',
      'Valid values: low, medium, high, critical',
    ],
    [
      'xp',
      'No',
      'Integer',
      'XP points. Defaults to 25 if blank. Set to 0 for no-XP tasks.',
    ],
    ['due_date', 'No', 'Date', 'YYYY-MM-DD format'],
    [
      'readiness_meter',
      'No',
      'Text',
      'Must match an existing readiness meter name',
    ],
    ['kpi', 'No', 'Text', 'Must match an existing KPI name'],
    [
      'depends_on',
      'No',
      'Text',
      'Task title of a dependency within the same mission',
    ],
    [
      'requires_approval',
      'No',
      'Boolean',
      'true or false. Defaults to true if blank.',
    ],
    ['', '', '', ''],
    [
      'WARNING',
      '',
      '',
      'You CANNOT import tasks into a quest that has been activated. The quest must still be in "planned" status.',
    ],
    [
      'NOTE',
      '',
      '',
      'Tasks are created with status "todo". Status progression happens in the app.',
    ],
  ],
  kpis: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'KPI name. Used for duplicate detection.'],
    ['description', 'Yes', 'Text', 'KPI description'],
    [
      'unit',
      'Yes',
      'Text',
      'Measurement unit (e.g., %, INR, count, hours, score)',
    ],
    ['target_value', 'Yes', 'Number', 'Target value to achieve'],
    [
      'domain',
      'Yes',
      'Text',
      'Domain area (e.g., food, ops, procurement, bi, talent)',
    ],
    ['current_value', 'No', 'Number', 'Defaults to 0 if blank'],
    [
      'status',
      'No',
      'Enum',
      'Valid values: on_track, at_risk, off_track. Defaults to on_track.',
    ],
    ['', '', '', ''],
    [
      'NOTE',
      '',
      '',
      'Linking KPIs to tasks is done separately in the app, not via import.',
    ],
  ],
  events: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['title', 'Yes', 'Text', 'Event title (3-200 chars)'],
    [
      'event_type',
      'Yes',
      'Enum',
      'Valid values: dining, workshop, pop_up, tasting, other',
    ],
    [
      'date',
      'Yes',
      'DateTime',
      'YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS format',
    ],
    ['capacity', 'Yes', 'Integer', 'Maximum guests (>= 1)'],
    ['price', 'Yes', 'Number', 'Price per guest in INR (>= 0)'],
    ['zone', 'No', 'Text', 'Must match an existing zone name'],
    ['brand', 'No', 'Text', 'Must match an existing brand name'],
    ['description', 'No', 'Text', 'Event description (max 2000 chars)'],
    ['', '', '', ''],
    [
      'NOTE',
      '',
      '',
      'Events are created with status "upcoming". When updating, capacity cannot be reduced below existing bookings and date cannot be changed if bookings exist.',
    ],
  ],
  recipes: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['', '', '', 'SHEET 1 — Recipe Headers'],
    ['name', 'Yes', 'Text', 'Recipe name. Used for duplicate detection.'],
    ['description', 'Yes', 'Text', 'Recipe description'],
    ['prep_steps', 'Yes', 'Text', 'Full preparation instructions'],
    [
      'cooking_method',
      'Yes',
      'Text',
      'e.g., "Pressure cook + tadka", "Grill + rest"',
    ],
    [
      'yield_qty',
      'Yes',
      'Number',
      'Number of portions/servings produced',
    ],
    ['yield_unit', 'Yes', 'Text', 'e.g., portions, kg, L, pieces'],
    ['portion_size', 'Yes', 'Text', 'e.g., "250g", "1 plate", "300ml"'],
    ['shelf_life_hours', 'No', 'Integer', 'Shelf life in hours'],
    ['brand', 'No', 'Text', 'Must match an existing brand name'],
    ['zone', 'No', 'Text', 'Must match an existing zone name'],
    ['', '', '', ''],
    ['', '', '', 'SHEET 2 — BOM Lines (Bill of Materials)'],
    [
      'recipe_name',
      'Yes',
      'Text',
      'Must match a recipe name in Sheet 1 or in the database',
    ],
    [
      'input_type',
      'Yes',
      'Enum',
      'ingredient (look up Ingredient table) or recipe (sub-recipe)',
    ],
    [
      'ingredient_name',
      'Yes',
      'Text',
      'Name of the ingredient or sub-recipe',
    ],
    ['quantity', 'Yes', 'Number', 'Quantity needed (> 0)'],
    ['unit', 'Yes', 'Text', 'e.g., g, ml, pieces, kg, L'],
    ['prep_notes', 'No', 'Text', 'e.g., "Soaked overnight", "Finely diced"'],
    ['', '', '', ''],
    [
      'WARNING',
      '',
      '',
      'Recipes are imported as "draft". Approve them in the app before linking to menu items.',
    ],
    [
      'WARNING',
      '',
      '',
      'Circular recipe references are not allowed.',
    ],
    [
      'WARNING',
      '',
      '',
      'CSV is not supported for recipes — use XLSX only.',
    ],
    [
      'WARNING',
      '',
      '',
      'When updating a draft recipe, ALL existing BOM lines are replaced.',
    ],
    [
      'WARNING',
      '',
      '',
      'Approved recipes CANNOT be updated via import.',
    ],
  ],
  menu_categories: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'Category name'],
    ['brand', 'Yes', 'Text', 'Must match an existing brand name'],
    [
      'sort_order',
      'No',
      'Integer',
      'Display order. Defaults to 0 if blank.',
    ],
    ['', '', '', ''],
    [
      'NOTE',
      '',
      '',
      'When updating, the brand cannot be changed (it would move all linked menu items).',
    ],
  ],
  menu_items: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'Menu item name'],
    [
      'recipe',
      'Yes',
      'Text',
      'Must match an APPROVED recipe name. Draft recipes are rejected.',
    ],
    [
      'category',
      'Yes',
      'Text',
      'Must match a menu category name within the specified brand',
    ],
    ['brand', 'Yes', 'Text', 'Used to find the correct category'],
    ['base_price', 'Yes', 'Number', 'Price in INR (>= 0.01)'],
    ['available', 'No', 'Boolean', 'true or false. Defaults to true.'],
    ['', '', '', ''],
    [
      'NOTE',
      '',
      '',
      'Workflow: 1) Import recipes 2) Approve recipes in app 3) Import menu categories 4) Import menu items',
    ],
    [
      'NOTE',
      '',
      '',
      'The recipe MUST be approved. The category is looked up by name within the brand.',
    ],
  ],
  purchase_orders: [
    ['Field Name', 'Required', 'Type', 'Description'],
    [
      'vendor',
      'Yes',
      'Text',
      'Must match an existing vendor name',
    ],
    [
      'zone',
      'Yes',
      'Text',
      'Must match an existing zone name (receiving zone)',
    ],
    [
      'status',
      'Yes',
      'Enum',
      'Valid values: draft, ordered',
    ],
    ['notes', 'No', 'Text', 'Optional notes for the purchase order'],
    [
      'linked_task',
      'No',
      'Text',
      'Optional task title to link this PO to. Must match an existing task.',
    ],
    ['', '', '', ''],
    [
      'NOTE',
      '',
      '',
      'PO headers only — order lines (ingredients + quantities) must be added in the app after import.',
    ],
    [
      'NOTE',
      '',
      '',
      'total_amount starts at 0 and is computed from lines added in-app.',
    ],
  ],
};

/** BOM columns for recipe Sheet 2 (D-13) */
const BOM_COLUMNS = [
  'recipe_name',
  'input_type',
  'ingredient_name',
  'quantity',
  'unit',
  'prep_notes',
];

/** Sample BOM row for recipe Sheet 2 */
const BOM_SAMPLE_DATA: Record<string, string> = {
  recipe_name: 'Dal Tadka',
  input_type: 'ingredient',
  ingredient_name: 'Toor Dal',
  quantity: '200',
  unit: 'g',
  prep_notes: 'Soaked 2 hours',
};

@Injectable()
export class TemplateService {
  async generateXlsx(importType: ImportType): Promise<Buffer> {
    const config = IMPORT_TYPE_CONFIG[importType];
    const sample = SAMPLE_DATA[importType];
    const instructions = INSTRUCTIONS[importType];

    const workbook = new ExcelJS.Workbook();

    // Data sheet FIRST (parser always reads worksheets[0])
    const dataSheet = workbook.addWorksheet(config.label);
    dataSheet.columns = config.columns.map((col) => ({
      header: col,
      key: col,
      width: Math.max(col.length + 4, 16),
    }));
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.addRow(sample);

    // Recipe special handling: 3-sheet XLSX (D-13)
    if (importType === 'recipes') {
      const bomSheet = workbook.addWorksheet('BOM Lines');
      bomSheet.columns = BOM_COLUMNS.map((col) => ({
        header: col,
        key: col,
        width: Math.max(col.length + 4, 16),
      }));
      bomSheet.getRow(1).font = { bold: true };
      bomSheet.addRow(BOM_SAMPLE_DATA);
    }

    // Instructions sheet (SECOND for normal types, THIRD for recipes)
    const instrSheet = workbook.addWorksheet('Instructions');
    instrSheet.columns = [
      { header: 'Field Name', key: 'field', width: 20 },
      { header: 'Required', key: 'required', width: 10 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Description', key: 'desc', width: 50 },
    ];
    instrSheet.getRow(1).font = { bold: true };
    for (const row of instructions.slice(1)) {
      instrSheet.addRow({
        field: row[0],
        required: row[1],
        type: row[2],
        desc: row[3],
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async generateCsv(importType: ImportType): Promise<Buffer> {
    // CSV not supported for recipes (D-13) — requires multi-sheet XLSX
    if (importType === 'recipes') {
      throw new BadRequestException(
        'CSV templates are not available for recipes — use XLSX',
      );
    }

    const config = IMPORT_TYPE_CONFIG[importType];
    const sample = SAMPLE_DATA[importType];
    const rows = [sample]; // one sample row
    return writeToBuffer(rows, { headers: config.columns }) as Promise<Buffer>;
  }
}
