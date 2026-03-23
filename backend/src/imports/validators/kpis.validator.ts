import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeNumber } from '../import-types';
import type { CellError, ImportRow } from '../import-types';

const VALID_STATUSES = ['on_track', 'at_risk', 'off_track'];

export async function validateKpiRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // name — required
  const name = (raw.name ?? '').trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Required' });
  } else {
    validated.name = name;
  }

  // description — required
  const description = (raw.description ?? '').trim();
  if (!description) {
    errors.push({ field: 'description', message: 'Required' });
  } else {
    validated.description = description;
  }

  // unit — required, free text
  const unit = (raw.unit ?? '').trim();
  if (!unit) {
    errors.push({ field: 'unit', message: 'Required' });
  } else {
    validated.unit = unit;
  }

  // target_value — required, must be a number
  const targetRaw = (raw.target_value ?? '').trim();
  if (!targetRaw) {
    errors.push({ field: 'target_value', message: 'Required' });
  } else {
    const tv = sanitizeNumber(targetRaw);
    if (tv === null) {
      errors.push({ field: 'target_value', message: 'Must be a number' });
    } else {
      validated.target_value = tv;
    }
  }

  // domain — required, free text
  const domain = (raw.domain ?? '').trim();
  if (!domain) {
    errors.push({ field: 'domain', message: 'Required' });
  } else {
    validated.domain = domain;
  }

  // current_value — optional, defaults to 0
  const currentRaw = (raw.current_value ?? '').trim();
  if (currentRaw) {
    const cv = sanitizeNumber(currentRaw);
    if (cv === null) {
      errors.push({ field: 'current_value', message: 'Must be a number' });
    } else {
      validated.current_value = cv;
    }
  } else {
    validated.current_value = 0;
  }

  // status — optional, default 'on_track'
  const statusRaw = (raw.status ?? '').trim().toLowerCase();
  if (statusRaw && !VALID_STATUSES.includes(statusRaw)) {
    errors.push({
      field: 'status',
      message: `Invalid status '${statusRaw}'. Valid values: ${VALID_STATUSES.join(', ')}`,
    });
  } else {
    validated.status = statusRaw || 'on_track';
  }

  // Duplicate detection by name (case-insensitive)
  let existingId: string | undefined;
  let rowStatus: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (name && errors.length === 0) {
    const existing = await prisma.kpi.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, current_value: true },
    });
    if (existing) {
      existingId = existing.id;
      rowStatus = 'duplicate';

      // D-02: Block if existing current_value > 0 and new value differs
      const newCurrentValue = (validated.current_value as number) ?? 0;
      if (existing.current_value > 0 && newCurrentValue !== existing.current_value) {
        errors.push({
          field: 'current_value',
          message: `Cannot overwrite measured KPI data — current_value is ${existing.current_value}`,
        });
        rowStatus = 'blocked';
      }
    }
  }

  return { rowIndex, raw, validated, errors, status: rowStatus, existingId };
}
