import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: { missionId?: string; page?: number; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (filters.missionId) {
      where.mission_id = filters.missionId;
    }

    const take = Math.min(Number(filters.limit) || 50, 100);
    const skip = ((Number(filters.page) || 1) - 1) * take;

    return this.prisma.quest.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ week_number: 'asc' }, { created_at: 'desc' }],
      take,
      skip,
    });
  }

  async findAllForExport(): Promise<any[]> {
    return this.prisma.quest.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        mission: { select: { id: true, title: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ week_number: 'asc' }, { created_at: 'desc' }],
    });
  }

  async findOne(id: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            task_type: true,
            owner_user_id: true,
            priority: true,
            due_date: true,
            blocked: true,
            depends_on_task_id: true,
          },
        },
        owner: { select: { id: true, name: true } },
        mission: { select: { id: true, title: true } },
      },
    });

    if (!quest) {
      throw new NotFoundException(`Quest with ID ${id} not found`);
    }

    return quest;
  }

  async create(dto: CreateQuestDto) {
    return this.prisma.quest.create({
      data: {
        mission_id: dto.mission_id,
        title: dto.title,
        description: dto.description,
        week_number: dto.week_number,
        owner_user_id: dto.owner_user_id,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateQuestDto) {
    const existing = await this.prisma.quest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Quest with ID ${id} not found`);
    }

    const updated = await this.prisma.quest.update({
      where: { id },
      data: {
        ...dto,
        start_date: dto.start_date === undefined ? undefined : (dto.start_date ? new Date(dto.start_date) : null),
        end_date: dto.end_date === undefined ? undefined : (dto.end_date ? new Date(dto.end_date) : null),
      },
    });

    if (dto.status) {
      await this.activateIfNeeded(id, dto.status);
    }

    return updated;
  }

  private async activateIfNeeded(id: string, newStatus: string) {
    if (newStatus === 'active') {
      await this.activate(id);
    }
  }

  private async activate(questId: string) {
    await this.prisma.$transaction(async (tx) => {
      const quest = await tx.quest.findUnique({
        where: { id: questId },
        select: { id: true, baseline_task_count: true },
      });
      if (!quest) return;

      // Only set baseline if not already set (immutable after first activation)
      if (quest.baseline_task_count > 0) {
        this.logger.log(
          `Quest ${questId} already has baseline_task_count=${quest.baseline_task_count}, skipping`,
        );
        return;
      }

      const coreTaskCount = await tx.task.count({
        where: {
          quest_id: questId,
          task_type: 'core',
        },
      });

      await tx.quest.update({
        where: { id: questId },
        data: { baseline_task_count: coreTaskCount },
      });

      this.logger.log(
        `Quest ${questId} activated with baseline_task_count=${coreTaskCount}`,
      );
    });
  }
}
