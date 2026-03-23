import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseCSV } from './parsers/csv.parser';
import { parseXLSX } from './parsers/xlsx.parser';
import { validateIngredientRow } from './validators/ingredients.validator';
import { validateVendorRow } from './validators/vendors.validator';
import { validateVendorPricingRow } from './validators/vendor-pricing.validator';
import {
  IMPORT_TYPE_CONFIG,
  type ImportType,
  type ImportRow,
  type ParseResult,
  type CommitResult,
} from './import-types';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async parseFile(
    buffer: Buffer,
    mimetype: string,
    importType: ImportType,
  ): Promise<ParseResult> {
    // Parse raw rows from file
    const rawRows =
      mimetype === 'text/csv' || mimetype === 'application/vnd.ms-excel'
        ? await parseCSV(buffer)
        : await parseXLSX(buffer);

    if (rawRows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }

    // Normalize headers to lowercase
    const normalizedRows = rawRows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[key.trim().toLowerCase()] = value;
      }
      return normalized;
    });

    // Validate each row against the import type's schema
    const validatedRows: ImportRow[] = [];
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const validated = await this.validateRow(
        row,
        i + 2, // +2: 1-based + header row
        importType,
      );
      validatedRows.push(validated);
    }

    const config = IMPORT_TYPE_CONFIG[importType];

    return {
      importType,
      rows: validatedRows,
      totalRows: validatedRows.length,
      validCount: validatedRows.filter((r) => r.status === 'valid').length,
      invalidCount: validatedRows.filter((r) => r.status === 'invalid').length,
      duplicateCount: validatedRows.filter((r) => r.status === 'duplicate')
        .length,
      columns: config.columns,
    };
  }

  private async validateRow(
    raw: Record<string, string>,
    rowIndex: number,
    importType: ImportType,
  ): Promise<ImportRow> {
    switch (importType) {
      case 'ingredients':
        return validateIngredientRow(raw, rowIndex, this.prisma);
      case 'vendors':
        return validateVendorRow(raw, rowIndex, this.prisma);
      case 'vendor_pricing':
        return validateVendorPricingRow(raw, rowIndex, this.prisma);
      default:
        throw new BadRequestException(`Unknown import type: ${importType}`);
    }
  }

  async commitImport(
    importType: ImportType,
    rows: ImportRow[],
    updateExisting: boolean,
  ): Promise<CommitResult> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errorCount = 0;
    const errorDetails: Array<{ rowIndex: number; message: string }> = [];

    // Filter to committable rows: valid + (duplicates if updateExisting)
    const committable = rows.filter((r) => {
      if (r.status === 'valid') return true;
      if (r.status === 'duplicate' && updateExisting) return true;
      if (r.status === 'duplicate' && !updateExisting) {
        skipped++;
        return false;
      }
      return false; // invalid rows
    });

    // Use Prisma transaction for atomicity per research recommendation
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const row of committable) {
          try {
            if (
              row.status === 'duplicate' &&
              updateExisting &&
              row.existingId
            ) {
              await this.updateRow(tx, importType, row);
              updated++;
            } else {
              await this.createRow(tx, importType, row);
              imported++;
            }
          } catch (err) {
            errorCount++;
            errorDetails.push({
              rowIndex: row.rowIndex,
              message:
                err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      });
    } catch (err) {
      this.logger.error('Import transaction failed', err);
      throw new BadRequestException(
        'Import failed — no rows were committed. ' +
          (err instanceof Error ? err.message : ''),
      );
    }

    return { imported, updated, skipped, errors: errorCount, errorDetails };
  }

  private async createRow(
    tx: any,
    importType: ImportType,
    row: ImportRow,
  ): Promise<void> {
    const v = row.validated;
    switch (importType) {
      case 'ingredients':
        await tx.ingredient.create({
          data: {
            name: v.name as string,
            category: v.category as string,
            base_unit: v.base_unit as string,
            min_stock_level: v.min_stock_level as number,
          },
        });
        break;
      case 'vendors':
        await tx.vendor.create({
          data: {
            name: v.name as string,
            phone: v.phone as string | undefined,
            email: v.email as string | undefined,
            address: v.address as string | undefined,
            payment_terms: v.payment_terms as string | undefined,
            status: (v.status as string) || 'active',
          },
        });
        break;
      case 'vendor_pricing':
        await tx.vendorPrice.create({
          data: {
            vendor_id: v.vendor_id as string,
            ingredient_id: v.ingredient_id as string,
            price: v.price as number,
            unit: v.unit as string,
            effective_date: v.effective_date as Date,
          },
        });
        break;
    }
  }

  private async updateRow(
    tx: any,
    importType: ImportType,
    row: ImportRow,
  ): Promise<void> {
    const v = row.validated;
    const id = row.existingId!;
    switch (importType) {
      case 'ingredients':
        await tx.ingredient.update({
          where: { id },
          data: {
            name: v.name as string,
            category: v.category as string,
            base_unit: v.base_unit as string,
            min_stock_level: v.min_stock_level as number,
          },
        });
        break;
      case 'vendors':
        await tx.vendor.update({
          where: { id },
          data: {
            name: v.name as string,
            phone: v.phone as string | undefined,
            email: v.email as string | undefined,
            address: v.address as string | undefined,
            payment_terms: v.payment_terms as string | undefined,
            status: (v.status as string) || 'active',
          },
        });
        break;
      case 'vendor_pricing':
        await tx.vendorPrice.update({
          where: { id },
          data: {
            vendor_id: v.vendor_id as string,
            ingredient_id: v.ingredient_id as string,
            price: v.price as number,
            unit: v.unit as string,
            effective_date: v.effective_date as Date,
          },
        });
        break;
    }
  }
}
