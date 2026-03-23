import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { IMPORT_TYPE_CONFIG, type ImportType } from './import-types';

const SAMPLE_DATA: Record<ImportType, Record<string, string>> = {
  ingredients: {
    name: 'Tomatoes',
    category: 'Produce',
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
    description: 'Establish core villa kitchen operations',
    phase: 'foundation',
    scope: 'food',
    start_date: '2026-04-01',
    end_date: '2026-06-30',
  },
  quests: {
    title: 'Week 1 Kitchen Setup',
    description: 'Set up all kitchen stations and initial inventory',
    mission: 'Foundation Setup',
    week_number: '1',
    owner_email: 'chef@konma.com',
    start_date: '2026-04-01',
    end_date: '2026-04-07',
  },
  tasks: {
    title: 'Organize prep station',
    description: 'Set up cutting boards, knife sets, and prep containers',
    mission: 'Foundation Setup',
    quest: 'Week 1 Kitchen Setup',
    owner_email: 'chef@konma.com',
    task_type: 'core',
    domain: 'food',
    priority: 'high',
    xp: '30',
    due_date: '2026-04-03',
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
    date: '2026-04-15',
    capacity: '30',
    price: '2500',
    zone: 'Garden Terrace',
    brand: 'Konma Food',
    description: 'A seasonal five-course dinner featuring local produce',
  },
  recipes: {
    name: 'Dal Tadka',
    description: 'Comfort yellow dal with ghee tempering',
    prep_steps: '1. Soak toor dal 2 hrs 2. Pressure cook 4 whistles',
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
      'Category (e.g., Produce, Dairy, Spices, Meat)',
    ],
    [
      'base_unit',
      'Yes',
      'Text',
      'Base measurement unit (e.g., kg, g, L, ml, pcs)',
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
    [
      'status',
      'No',
      'Text',
      'active or inactive (defaults to active)',
    ],
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
    ['ingredient', 'Yes', 'Text', 'Must match an existing ingredient name exactly'],
    ['zone', 'Yes', 'Text', 'Must match an existing zone name'],
    ['zone_id', 'No', 'UUID', 'Optional fallback — overrides zone name if both provided'],
    ['quantity', 'Yes', 'Number', 'Opening quantity (must be positive)'],
    ['unit', 'Yes', 'Text', 'Must convert to ingredient base_unit. Safe values: g, kg, ml, L, pieces, dozen'],
    ['reason', 'No', 'Text', 'Defaults to "Opening stock" if blank'],
  ],
  missions: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['title', 'Yes', 'Text', 'Mission title (min 3 chars, used for duplicate detection)'],
    ['description', 'Yes', 'Text', 'Mission description'],
    ['phase', 'Yes', 'Enum', 'Valid values: setup, foundation, activation, scale'],
    ['scope', 'Yes', 'Enum', 'Valid values: food, art, lifestyle, system, mixed'],
    ['start_date', 'No', 'Date', 'YYYY-MM-DD format'],
    ['end_date', 'No', 'Date', 'YYYY-MM-DD format'],
  ],
  quests: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['title', 'Yes', 'Text', 'Quest title (min 3 chars)'],
    ['description', 'Yes', 'Text', 'Quest description'],
    ['mission', 'Yes', 'Text', 'Must match an existing mission title'],
    ['week_number', 'Yes', 'Integer', 'Week number (1 or greater)'],
    ['owner_email', 'Yes', 'Email', 'Must match a registered user email'],
    ['start_date', 'No', 'Date', 'YYYY-MM-DD format'],
    ['end_date', 'No', 'Date', 'YYYY-MM-DD format'],
  ],
  tasks: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['title', 'Yes', 'Text', 'Task title (min 3 chars)'],
    ['description', 'Yes', 'Text', 'Task description'],
    ['mission', 'Yes', 'Text', 'Must match an existing mission title'],
    ['quest', 'No', 'Text', 'Must match a quest title within the specified mission'],
    ['owner_email', 'Yes', 'Email', 'Must match a registered user email'],
    ['task_type', 'Yes', 'Enum', 'Valid values: core, adhoc, improvement'],
    ['domain', 'Yes', 'Enum', 'Valid values: food, art, lifestyle, ops, procurement, bi, talent, tech, design'],
    ['priority', 'Yes', 'Enum', 'Valid values: low, medium, high, critical'],
    ['xp', 'No', 'Integer', 'Experience points (defaults to 25 if blank)'],
    ['due_date', 'No', 'Date', 'YYYY-MM-DD format'],
  ],
  kpis: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'KPI name (used for duplicate detection)'],
    ['description', 'Yes', 'Text', 'KPI description'],
    ['unit', 'Yes', 'Text', 'Measurement unit (e.g., %, INR, count, hours, score)'],
    ['target_value', 'Yes', 'Number', 'Target value'],
    ['domain', 'Yes', 'Text', 'Domain (e.g., food, ops, procurement, bi, talent)'],
    ['current_value', 'No', 'Number', 'Current value (defaults to 0)'],
    ['status', 'No', 'Enum', 'Valid values: on_track, at_risk, off_track (defaults to on_track)'],
  ],
  events: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['title', 'Yes', 'Text', 'Event title (3-200 chars)'],
    ['event_type', 'Yes', 'Enum', 'Valid values: dining, workshop, pop_up, tasting, other'],
    ['date', 'Yes', 'Date', 'YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS'],
    ['capacity', 'Yes', 'Integer', 'Maximum guests (1 or greater)'],
    ['price', 'Yes', 'Number', 'Price per guest in INR (0 or greater)'],
    ['zone', 'No', 'Text', 'Must match an existing zone name'],
    ['brand', 'No', 'Text', 'Must match an existing brand name'],
    ['description', 'No', 'Text', 'Event description (max 2000 chars)'],
  ],
  recipes: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'Recipe name (used for duplicate detection)'],
    ['description', 'Yes', 'Text', 'Recipe description'],
    ['prep_steps', 'Yes', 'Text', 'Full preparation instructions'],
    ['cooking_method', 'Yes', 'Text', 'Cooking method (e.g., Pressure cook + tadka)'],
    ['yield_qty', 'Yes', 'Number', 'Yield quantity (greater than 0)'],
    ['yield_unit', 'Yes', 'Text', 'Yield unit (e.g., portions, kg, L, pieces)'],
    ['portion_size', 'Yes', 'Text', 'Portion size (e.g., 250g, 1 plate, 300ml)'],
    ['shelf_life_hours', 'No', 'Integer', 'Shelf life in hours'],
    ['brand', 'No', 'Text', 'Must match an existing brand name'],
    ['zone', 'No', 'Text', 'Must match an existing zone name'],
  ],
  menu_categories: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'Category name'],
    ['brand', 'Yes', 'Text', 'Must match an existing brand name'],
    ['sort_order', 'No', 'Integer', 'Display order (defaults to 0)'],
  ],
  menu_items: [
    ['Field Name', 'Required', 'Type', 'Description'],
    ['name', 'Yes', 'Text', 'Menu item name'],
    ['recipe', 'Yes', 'Text', 'Must match an APPROVED recipe name'],
    ['category', 'Yes', 'Text', 'Must match a menu category within the brand'],
    ['brand', 'Yes', 'Text', 'Must match an existing brand name'],
    ['base_price', 'Yes', 'Number', 'Price in INR (0.01 or greater)'],
    ['available', 'No', 'Boolean', 'true or false (defaults to true)'],
  ],
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

    // Instructions sheet SECOND per D-10
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
    const config = IMPORT_TYPE_CONFIG[importType];
    const sample = SAMPLE_DATA[importType];
    const rows = [sample]; // one sample row
    return writeToBuffer(rows, { headers: config.columns }) as Promise<Buffer>;
  }
}
