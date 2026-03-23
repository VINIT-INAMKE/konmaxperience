import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';
import { sanitizeNumber, parseDateUTC } from '../import-types';

export async function validateQuestRow(
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

  // mission — required, FK resolution by title
  const missionName = (raw.mission ?? '').trim();
  if (!missionName) {
    errors.push({ field: 'mission', message: 'Required' });
  } else {
    const mission = await prisma.mission.findFirst({
      where: { title: { equals: missionName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!mission) {
      errors.push({
        field: 'mission',
        message: `Mission '${missionName}' not found`,
      });
    } else {
      validated.mission_id = mission.id;
    }
  }

  // week_number — required, integer >= 1
  const weekRaw = (raw.week_number ?? '').trim();
  if (!weekRaw) {
    errors.push({ field: 'week_number', message: 'Required' });
  } else {
    const val = sanitizeNumber(weekRaw);
    if (val === null || val < 1 || Math.floor(val) !== val) {
      errors.push({
        field: 'week_number',
        message: 'Must be an integer >= 1',
      });
    } else {
      validated.week_number = val;
    }
  }

  // owner_email — required, FK resolution by email
  const ownerEmail = (raw.owner_email ?? '').trim().toLowerCase();
  if (!ownerEmail) {
    errors.push({ field: 'owner_email', message: 'Required' });
  } else {
    const user = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });
    if (!user) {
      errors.push({
        field: 'owner_email',
        message: `User with email '${ownerEmail}' not found`,
      });
    } else {
      validated.owner_user_id = user.id;
    }
  }

  // start_date — optional
  const startDateRaw = (raw.start_date ?? '').trim();
  if (startDateRaw) {
    const parsed = parseDateUTC(startDateRaw);
    if (!parsed) {
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
    const parsed = parseDateUTC(endDateRaw);
    if (!parsed) {
      errors.push({
        field: 'end_date',
        message: 'Invalid date (expected YYYY-MM-DD)',
      });
    } else {
      validated.end_date = parsed;
    }
  }

  // Duplicate detection: title + mission_id
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (errors.length === 0 && validated.mission_id && validated.title) {
    const existing = await prisma.quest.findFirst({
      where: {
        title: { equals: validated.title as string, mode: 'insensitive' },
        mission_id: validated.mission_id as string,
      },
      select: { id: true, status: true },
    });
    if (existing) {
      existingId = existing.id;
      // D-02 blocked check: if quest is not planned, cannot modify
      if (existing.status !== 'planned') {
        errors.push({
          field: 'title',
          message: `Quest is ${existing.status} — cannot modify`,
        });
        status = 'blocked';
      } else {
        status = 'duplicate';
      }
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
