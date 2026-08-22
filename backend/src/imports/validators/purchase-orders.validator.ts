import { PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';

const VALID_STATUSES: string[] = [
  PurchaseOrderStatus.draft,
  PurchaseOrderStatus.ordered,
];

export async function validatePurchaseOrderRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // vendor — required, FK resolution by name
  const vendorName = (raw.vendor ?? '').trim();
  if (!vendorName) {
    errors.push({ field: 'vendor', message: 'Required' });
  } else {
    const vendor = await prisma.vendor.findFirst({
      where: { name: { equals: vendorName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!vendor) {
      errors.push({
        field: 'vendor',
        message: `Vendor '${vendorName}' not found`,
      });
    } else {
      validated.vendor_id = vendor.id;
    }
  }

  // zone — required, FK resolution by name
  const zoneName = (raw.zone ?? '').trim();
  if (!zoneName) {
    errors.push({ field: 'zone', message: 'Required' });
  } else {
    const zone = await prisma.zone.findFirst({
      where: { name: { equals: zoneName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!zone) {
      errors.push({
        field: 'zone',
        message: `Zone '${zoneName}' not found`,
      });
    } else {
      validated.zone_id = zone.id;
    }
  }

  // status — required, enum
  const status = (raw.status ?? '').trim().toLowerCase();
  if (!status) {
    errors.push({ field: 'status', message: 'Required' });
  } else if (!VALID_STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `Invalid status '${status}'. Valid values: draft, ordered`,
    });
  } else {
    validated.status = status;
  }

  // notes — optional
  const notes = (raw.notes ?? '').trim();
  if (notes) {
    validated.notes = notes;
  }

  // linked_task — optional, FK resolution by title
  const linkedTaskTitle = (raw.linked_task ?? '').trim();
  if (linkedTaskTitle) {
    const task = await prisma.task.findFirst({
      where: { title: { equals: linkedTaskTitle, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!task) {
      errors.push({
        field: 'linked_task',
        message: `Task '${linkedTaskTitle}' not found`,
      });
    } else {
      validated.linked_task_id = task.id;
    }
  }

  // Duplicate detection: vendor_id + zone_id + status=draft (same vendor+zone draft PO)
  let existingId: string | undefined;
  let rowStatus: ImportRow['status'] =
    errors.length > 0 ? 'invalid' : 'valid';

  if (
    errors.length === 0 &&
    validated.vendor_id &&
    validated.zone_id &&
    validated.status === 'draft'
  ) {
    const existing = await prisma.purchaseOrder.findFirst({
      where: {
        vendor_id: validated.vendor_id as string,
        zone_id: validated.zone_id as string,
        status: 'draft',
      },
      select: { id: true },
    });
    if (existing) {
      existingId = existing.id;
      rowStatus = 'duplicate';
    }
  }

  return { rowIndex, raw, validated, errors, status: rowStatus, existingId };
}
