import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';

const DECISION_INCLUDE = {
  proposer: { select: { id: true, name: true } },
  linked_mission: { select: { id: true, title: true } },
  linked_task: { select: { id: true, title: true } },
} as const;

@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string, page?: number, limit?: number) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    return this.prisma.decision.findMany({
      where,
      include: DECISION_INCLUDE,
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
  }

  async findOne(id: string) {
    const decision = await this.prisma.decision.findUnique({
      where: { id },
      include: DECISION_INCLUDE,
    });
    if (!decision) {
      throw new NotFoundException(`Decision with ID ${id} not found`);
    }
    return decision;
  }

  async create(dto: CreateDecisionDto, proposerId: string) {
    return this.prisma.decision.create({
      data: {
        title: dto.title,
        decision_type: dto.decision_type,
        context: dto.context,
        proposed_by: proposerId,
        impact_scope: 'ops',
        status: 'proposed',
        linked_mission_id: dto.linked_mission_id ?? null,
        linked_task_id: dto.linked_task_id ?? null,
      },
      include: DECISION_INCLUDE,
    });
  }

  async update(
    id: string,
    dto: UpdateDecisionDto,
    userId: string,
    isAdmin: boolean,
  ) {
    const decision = await this.findOne(id);

    if (decision.status === 'approved' && !isAdmin) {
      throw new ForbiddenException(
        'Approved decisions are locked. Only admin can reopen.',
      );
    }

    if (dto.status === 'proposed' && !isAdmin) {
      throw new ForbiddenException(
        'Approved decisions are locked. Only admin can reopen.',
      );
    }

    return this.prisma.decision.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.decision_type !== undefined && {
          decision_type: dto.decision_type,
        }),
        ...(dto.context !== undefined && { context: dto.context }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.linked_mission_id !== undefined && {
          linked_mission_id: dto.linked_mission_id,
        }),
        ...(dto.linked_task_id !== undefined && {
          linked_task_id: dto.linked_task_id,
        }),
      },
      include: DECISION_INCLUDE,
    });
  }

  async remove(id: string, isAdmin: boolean) {
    const decision = await this.findOne(id);

    if (decision.status === 'approved') {
      throw new ForbiddenException('Cannot delete an approved decision');
    }

    if (!isAdmin && decision.status !== 'proposed') {
      throw new ForbiddenException(
        'Only admins can delete non-proposed decisions',
      );
    }

    return this.prisma.decision.delete({ where: { id } });
  }
}
