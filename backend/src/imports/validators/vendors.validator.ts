import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';

const VALID_STATUSES = ['active', 'inactive'];

export async function validateVendorRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // name — required string
  const name = (raw.name ?? '').trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Required' });
  } else {
    validated.name = name;
  }

  // phone — optional string
  validated.phone = (raw.phone ?? '').trim() || undefined;

  // email — optional string, basic format check
  const email = (raw.email ?? '').trim();
  if (email && !email.includes('@')) {
    errors.push({ field: 'email', message: 'Invalid email address' });
  } else {
    validated.email = email || undefined;
  }

  // address — optional string
  validated.address = (raw.address ?? '').trim() || undefined;

  // payment_terms — optional string
  validated.payment_terms = (raw.payment_terms ?? '').trim() || undefined;

  // status — optional, defaults to "active", must be "active" or "inactive"
  const status = (raw.status ?? '').trim().toLowerCase();
  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: 'Must be "active" or "inactive"',
    });
  } else {
    validated.status = status || 'active';
  }

  // Duplicate detection by name per D-18
  let existingId: string | undefined;
  let rowStatus: ImportRow['status'] =
    errors.length > 0 ? 'invalid' : 'valid';

  if (name && errors.length === 0) {
    const existing = await prisma.vendor.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      existingId = existing.id;
      rowStatus = 'duplicate';
    }
  }

  return { rowIndex, raw, validated, errors, status: rowStatus, existingId };
}
