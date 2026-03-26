import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';
import { sanitizeNumber, parseDateUTC } from '../import-types';

const VALID_TASK_TYPES = ['core', 'adhoc', 'improvement'];
const VALID_DOMAINS = [
  'food',
  'art',
  'lifestyle',
  'ops',
  'procurement',
  'bi',
  'talent',
  'tech',
  'design',
];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

export async function validateTaskRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};
  let isBlocked = false;

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

  // quest — optional, FK resolution by title within mission
  const questName = (raw.quest ?? '').trim();
  if (questName && !validated.mission_id) {
    // FIX 5: Explicit error when quest specified but mission is invalid
    errors.push({
      field: 'quest',
      message: 'Cannot resolve quest without a valid mission',
    });
  } else if (questName && validated.mission_id) {
    const quest = await prisma.quest.findFirst({
      where: {
        title: { equals: questName, mode: 'insensitive' },
        mission_id: validated.mission_id as string,
      },
      select: { id: true, status: true },
    });
    if (!quest) {
      errors.push({
        field: 'quest',
        message: `Quest '${questName}' not found in mission`,
      });
    } else {
      // D-24: Block task import into active/completed quests
      if (quest.status !== 'planned') {
        errors.push({
          field: 'quest',
          message: `Quest is ${quest.status} — only planned quests accept new tasks`,
        });
        isBlocked = true;
      }
      validated.quest_id = quest.id;
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

  // task_type — required, enum
  const taskType = (raw.task_type ?? '').trim().toLowerCase();
  if (!taskType) {
    errors.push({ field: 'task_type', message: 'Required' });
  } else if (!VALID_TASK_TYPES.includes(taskType)) {
    errors.push({
      field: 'task_type',
      message: `Invalid task_type '${taskType}'. Valid values: core, adhoc, improvement`,
    });
  } else {
    validated.task_type = taskType;
  }

  // domain — required, enum
  const domain = (raw.domain ?? '').trim().toLowerCase();
  if (!domain) {
    errors.push({ field: 'domain', message: 'Required' });
  } else if (!VALID_DOMAINS.includes(domain)) {
    errors.push({
      field: 'domain',
      message: `Invalid domain '${domain}'. Valid values: food, art, lifestyle, ops, procurement, bi, talent, tech, design`,
    });
  } else {
    validated.domain = domain;
  }

  // priority — required, enum
  const priority = (raw.priority ?? '').trim().toLowerCase();
  if (!priority) {
    errors.push({ field: 'priority', message: 'Required' });
  } else if (!VALID_PRIORITIES.includes(priority)) {
    errors.push({
      field: 'priority',
      message: `Invalid priority '${priority}'. Valid values: low, medium, high, critical`,
    });
  } else {
    validated.priority = priority;
  }

  // xp — optional, defaults to 25
  const xpRaw = (raw.xp ?? '').trim();
  if (xpRaw) {
    const val = sanitizeNumber(xpRaw);
    if (val === null || val < 0 || Math.floor(val) !== val) {
      errors.push({
        field: 'xp',
        message: 'Must be an integer >= 0',
      });
    } else {
      validated.xp = val;
    }
  } else {
    validated.xp = 25;
  }

  // due_date — optional
  const dueDateRaw = (raw.due_date ?? '').trim();
  if (dueDateRaw) {
    const parsed = parseDateUTC(dueDateRaw);
    if (!parsed) {
      errors.push({
        field: 'due_date',
        message: 'Invalid date (expected YYYY-MM-DD)',
      });
    } else {
      validated.due_date = parsed;
    }
  }

  // readiness_meter — optional, FK resolution by name
  const readinessMeterName = (raw.readiness_meter ?? '').trim();
  if (readinessMeterName) {
    const meter = await prisma.readinessMeter.findFirst({
      where: { name: { equals: readinessMeterName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!meter) {
      errors.push({
        field: 'readiness_meter',
        message: `Readiness meter '${readinessMeterName}' not found`,
      });
    } else {
      validated.readiness_meter_id = meter.id;
    }
  }

  // kpi — optional, FK resolution by name
  const kpiName = (raw.kpi ?? '').trim();
  if (kpiName) {
    const kpi = await prisma.kpi.findFirst({
      where: { name: { equals: kpiName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!kpi) {
      errors.push({
        field: 'kpi',
        message: `KPI '${kpiName}' not found`,
      });
    } else {
      validated.kpi_id = kpi.id;
    }
  }

  // depends_on — optional, FK resolution by task title within same mission
  const dependsOnTitle = (raw.depends_on ?? '').trim();
  if (dependsOnTitle) {
    if (!validated.mission_id) {
      errors.push({
        field: 'depends_on',
        message: 'Cannot resolve dependency without a valid mission',
      });
    } else {
      const depTask = await prisma.task.findFirst({
        where: {
          title: { equals: dependsOnTitle, mode: 'insensitive' },
          mission_id: validated.mission_id as string,
        },
        select: { id: true },
      });
      if (!depTask) {
        errors.push({
          field: 'depends_on',
          message: `Task '${dependsOnTitle}' not found in mission`,
        });
      } else {
        validated.depends_on_task_id = depTask.id;
      }
    }
  }

  // requires_approval — optional boolean, defaults to true
  const requiresApprovalRaw = (raw.requires_approval ?? '').trim().toLowerCase();
  if (requiresApprovalRaw) {
    if (requiresApprovalRaw === 'true' || requiresApprovalRaw === '1' || requiresApprovalRaw === 'yes') {
      validated.requires_approval = true;
    } else if (requiresApprovalRaw === 'false' || requiresApprovalRaw === '0' || requiresApprovalRaw === 'no') {
      validated.requires_approval = false;
    } else {
      errors.push({
        field: 'requires_approval',
        message: 'Must be true or false',
      });
    }
  } else {
    validated.requires_approval = true;
  }

  // Duplicate detection: title + mission_id + quest_id
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (isBlocked) {
    status = 'blocked';
  }

  if (
    !isBlocked &&
    errors.length === 0 &&
    validated.mission_id &&
    validated.title
  ) {
    const existing = await prisma.task.findFirst({
      where: {
        title: { equals: validated.title as string, mode: 'insensitive' },
        mission_id: validated.mission_id as string,
        quest_id: (validated.quest_id as string) ?? null,
      },
      select: { id: true, status: true },
    });
    if (existing) {
      existingId = existing.id;
      // D-02 blocked check: cannot modify completed task
      if (existing.status === 'done') {
        errors.push({
          field: 'title',
          message: 'Cannot modify completed task',
        });
        status = 'blocked';
      } else {
        status = 'duplicate';
      }
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
