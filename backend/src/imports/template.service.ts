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
