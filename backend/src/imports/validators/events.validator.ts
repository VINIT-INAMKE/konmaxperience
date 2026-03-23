import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeNumber, parseDateUTC } from '../import-types';
import type { CellError, ImportRow } from '../import-types';

const VALID_EVENT_TYPES = ['dining', 'workshop', 'pop_up', 'tasting', 'other'];

export async function validateEventRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // title — required, 3-200 chars
  const title = (raw.title ?? '').trim();
  if (!title || title.length < 3 || title.length > 200) {
    errors.push({ field: 'title', message: 'Required (3-200 chars)' });
  } else {
    validated.title = title;
  }

  // event_type — required, enum
  const eventType = (raw.event_type ?? '').trim().toLowerCase();
  if (!eventType) {
    errors.push({ field: 'event_type', message: 'Required' });
  } else if (!VALID_EVENT_TYPES.includes(eventType)) {
    errors.push({
      field: 'event_type',
      message: `Invalid event_type '${eventType}'. Valid values: ${VALID_EVENT_TYPES.join(', ')}`,
    });
  } else {
    validated.event_type = eventType;
  }

  // date — required, parse as Date
  const dateRaw = (raw.date ?? '').trim();
  let validatedDate: Date | null = null;
  if (!dateRaw) {
    errors.push({ field: 'date', message: 'Required' });
  } else {
    const parsed = parseDateUTC(dateRaw);
    if (!parsed) {
      errors.push({
        field: 'date',
        message: 'Invalid date (expected YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)',
      });
    } else {
      validated.date = parsed;
      validatedDate = parsed;
    }
  }

  // capacity — required, integer >= 1
  const capacityRaw = (raw.capacity ?? '').trim();
  let validatedCapacity: number | null = null;
  if (!capacityRaw) {
    errors.push({ field: 'capacity', message: 'Required' });
  } else {
    const cap = sanitizeNumber(capacityRaw);
    if (cap === null || cap < 1 || Math.floor(cap) !== cap) {
      errors.push({ field: 'capacity', message: 'Must be an integer >= 1' });
    } else {
      validated.capacity = cap;
      validatedCapacity = cap;
    }
  }

  // price — required, >= 0
  const priceRaw = (raw.price ?? '').trim();
  if (!priceRaw) {
    errors.push({ field: 'price', message: 'Required' });
  } else {
    const p = sanitizeNumber(priceRaw);
    if (p === null || p < 0) {
      errors.push({ field: 'price', message: 'Must be a number >= 0' });
    } else {
      validated.price = p;
    }
  }

  // zone — optional, use findMany ambiguity pattern (D-04)
  const zoneName = (raw.zone ?? '').trim();
  if (zoneName) {
    const zones = await prisma.zone.findMany({
      where: { name: { equals: zoneName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (zones.length === 0) {
      errors.push({
        field: 'zone',
        message: `Zone '${zoneName}' not found`,
      });
    } else if (zones.length > 1) {
      errors.push({
        field: 'zone',
        message: `Multiple zones named '${zoneName}' found — use zone_id column`,
      });
    } else {
      validated.zone_id = zones[0].id;
    }
  }

  // brand — optional, use findMany ambiguity pattern (D-04)
  const brandName = (raw.brand ?? '').trim();
  if (brandName) {
    const brands = await prisma.brand.findMany({
      where: { name: { equals: brandName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (brands.length === 0) {
      errors.push({
        field: 'brand',
        message: `Brand '${brandName}' not found`,
      });
    } else if (brands.length > 1) {
      errors.push({
        field: 'brand',
        message: `Multiple brands named '${brandName}' found — use brand_id column`,
      });
    } else {
      validated.brand_id = brands[0].id;
    }
  }

  // description — optional, max 2000 chars
  const description = (raw.description ?? '').trim();
  if (description) {
    if (description.length > 2000) {
      errors.push({ field: 'description', message: 'Max 2000 characters' });
    } else {
      validated.description = description;
    }
  }

  // Duplicate detection: search by title only, then compare date
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (title && title.length >= 3 && validatedDate && errors.length === 0) {
    const existing = await prisma.event.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
      },
      select: {
        id: true,
        date: true,
        capacity: true,
        _count: { select: { bookings: true } },
      },
    });
    if (existing) {
      const bookingCount = existing._count.bookings;

      // Title matches but dates differ — this is a new record, not a duplicate
      if (validatedDate.getTime() !== existing.date.getTime()) {
        // Cannot change event date if bookings exist (updating same-title event)
        if (bookingCount > 0) {
          existingId = existing.id;
          errors.push({
            field: 'date',
            message: `Cannot change event date — ${bookingCount} bookings exist`,
          });
          status = 'blocked';
        }
        // If no bookings, treat as duplicate that will update the date
        else {
          existingId = existing.id;
          status = 'duplicate';
        }
      } else {
        // Title AND date match — true duplicate
        existingId = existing.id;
        status = 'duplicate';
      }

      // Cannot reduce capacity below existing bookings
      if (
        existingId &&
        validatedCapacity !== null &&
        validatedCapacity < bookingCount
      ) {
        errors.push({
          field: 'capacity',
          message: `Cannot reduce capacity below ${bookingCount} existing bookings`,
        });
        status = 'blocked';
      }
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
