import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { UpdateKpiDto } from './dto/update-kpi.dto';

const ROLE_DOMAIN_MAP: Record<string, string> = {
  BACKEND_LEAD: 'backend',
  FRONTEND_LEAD: 'frontend',
  BI_LEAD: 'bi',
  PROCUREMENT_LEAD: 'procurement',
  TALENT_LEAD: 'talent',
  TECH_LEAD: 'tech',
  DESIGN_OUTREACH_LEAD: 'design',
};

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(roleCode: string) {
    const where: Record<string, unknown> = {};

    if (roleCode !== 'FOUNDER_ADMIN' && roleCode !== 'BI_LEAD') {
      const domain = ROLE_DOMAIN_MAP[roleCode];
      if (domain) {
        where.domain = domain;
      }
    }

    return this.prisma.kpi.findMany({
      where,
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            valid: true,
          },
        },
      },
      orderBy: { domain: 'asc' },
    });
  }

  async findOne(id: string) {
    const kpi = await this.prisma.kpi.findUnique({
      where: { id },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            valid: true,
          },
        },
      },
    });

    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${id} not found`);
    }

    return kpi;
  }

  async create(dto: CreateKpiDto) {
    const kpi = await this.prisma.kpi.create({
      data: {
        name: dto.name,
        description: dto.description,
        unit: dto.unit,
        target_value: dto.target_value,
        current_value: dto.current_value ?? 0,
        status: dto.status || 'on_track',
        domain: dto.domain,
      },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            valid: true,
          },
        },
      },
    });

    if (dto.linked_task_ids && dto.linked_task_ids.length > 0) {
      await this.prisma.task.updateMany({
        where: { id: { in: dto.linked_task_ids } },
        data: { kpi_id: kpi.id },
      });
    }

    return kpi;
  }

  async update(id: string, dto: UpdateKpiDto) {
    const existing = await this.prisma.kpi.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`KPI with ID ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.target_value !== undefined) data.target_value = dto.target_value;
    if (dto.current_value !== undefined) data.current_value = dto.current_value;
    if (dto.status !== undefined) data.status = dto.status;

    const kpi = await this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.kpi.update({
        where: { id },
        data,
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              valid: true,
            },
          },
        },
      });

      if (dto.linked_task_ids !== undefined) {
        // Clear all currently linked tasks
        await tx.task.updateMany({
          where: { kpi_id: id },
          data: { kpi_id: null },
        });

        // Set new links if any
        if (dto.linked_task_ids.length > 0) {
          await tx.task.updateMany({
            where: { id: { in: dto.linked_task_ids } },
            data: { kpi_id: id },
          });
        }
      }

      return updated;
    });

    return kpi;
  }
}
