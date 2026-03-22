import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page?: number, limit?: number) {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    return this.prisma.mission.findMany({
      include: {
        _count: { select: { quests: true } },
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
  }

  async findOne(id: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        quests: {
          select: {
            id: true,
            title: true,
            status: true,
            week_number: true,
            owner_user_id: true,
            progress_percent: true,
            core_progress_percent: true,
            adhoc_progress_percent: true,
          },
        },
      },
    });

    if (!mission) {
      throw new NotFoundException(`Mission with ID ${id} not found`);
    }

    return mission;
  }

  async create(dto: CreateMissionDto, userId: string) {
    return this.prisma.mission.create({
      data: {
        title: dto.title,
        description: dto.description,
        phase: dto.phase,
        scope: dto.scope,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        created_by: userId,
      },
    });
  }

  async update(id: string, dto: UpdateMissionDto) {
    const existing = await this.prisma.mission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Mission with ID ${id} not found`);
    }

    return this.prisma.mission.update({
      where: { id },
      data: {
        ...dto,
        start_date: dto.start_date === undefined ? undefined : (dto.start_date ? new Date(dto.start_date) : null),
        end_date: dto.end_date === undefined ? undefined : (dto.end_date ? new Date(dto.end_date) : null),
      },
    });
  }
}
