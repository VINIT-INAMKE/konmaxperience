import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';

const VALID_PHASES = ['setup', 'foundation', 'activation', 'scale'];
const VALID_SCOPES = ['food', 'art', 'lifestyle', 'system', 'mixed'];

export async function validateMissionRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // title — required, min 3 chars
  const title = (raw.title ?? '').trim();
  if (!title || title.length < 3) {
    errors.push({ field: 'title', message: 'Required (min 3 chars)' });
  } else {
    validated.title = title;
  }

  // description — required
  const description = (raw.description ?? '').trim();
  if (!description) {
    errors.push({ field: 'description', message: 'Required' });
  } else {
    validated.description = description;
  }

  // phase — required, enum
  const phase = (raw.phase ?? '').trim().toLowerCase();
  if (!phase) {
    errors.push({ field: 'phase', message: 'Required' });
  } else if (!VALID_PHASES.includes(phase)) {
    errors.push({
      field: 'phase',
      message: `Invalid phase '${phase}'. Valid values: ${VALID_PHASES.join(', ')}`,
    });
  } else {
    validated.phase = phase;
  }

  // scope — required, enum
  const scope = (raw.scope ?? '').trim().toLowerCase();
  if (!scope) {
    errors.push({ field: 'scope', message: 'Required' });
  } else if (!VALID_SCOPES.includes(scope)) {
    errors.push({
      field: 'scope',
      message: `Invalid scope '${scope}'. Valid values: ${VALID_SCOPES.join(', ')}`,
    });
  } else {
    validated.scope = scope;
  }

  // start_date — optional
  const startDateRaw = (raw.start_date ?? '').trim();
  if (startDateRaw) {
    const parsed = new Date(startDateRaw);
    if (isNaN(parsed.getTime())) {
      errors.push({
        field: 'start_date',
        message: 'Invalid date (expected YYYY-MM-DD)',
      });
    } else {
      validated.start_date = parsed;
    }
  }

  // end_date — optional
  const endDateRaw = (raw.end_date ?? '').trim();
  if (endDateRaw) {
    const parsed = new Date(endDateRaw);
    if (isNaN(parsed.getTime())) {
      errors.push({
        field: 'end_date',
        message: 'Invalid date (expected YYYY-MM-DD)',
      });
    } else {
      validated.end_date = parsed;
    }
  }

  // Duplicate detection by title (case-insensitive)
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (title && title.length >= 3 && errors.length === 0) {
    const existing = await prisma.mission.findFirst({
      where: { title: { equals: title, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      existingId = existing.id;
      status = 'duplicate';
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
