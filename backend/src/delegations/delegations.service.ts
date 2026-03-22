import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

const DELEGATION_INCLUDE = {
  from_user: { select: { id: true, name: true } },
  to_user: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
} as const;

@Injectable()
export class DelegationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.approvalDelegation.findMany({
      include: DELEGATION_INCLUDE,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async findActive() {
    const now = new Date();
    return this.prisma.approvalDelegation.findMany({
      where: {
        active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
      include: DELEGATION_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }

  async getActiveDelegationForUser(toUserId: string) {
    const now = new Date();
    return this.prisma.approvalDelegation.findFirst({
      where: {
        to_user_id: toUserId,
        active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
      include: {
        from_user: { select: { id: true, name: true, role_id: true } },
      },
    });
  }

  async create(dto: CreateDelegationDto, adminId: string) {
    if (dto.from_user_id === dto.to_user_id) {
      throw new BadRequestException('Cannot delegate to yourself');
    }

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (endDate < startDate) {
      throw new BadRequestException('end_date must be on or after start_date');
    }

    return this.prisma.approvalDelegation.create({
      data: {
        from_user_id: dto.from_user_id,
        to_user_id: dto.to_user_id,
        start_date: startDate,
        end_date: endDate,
        created_by: adminId,
        active: true,
      },
      include: DELEGATION_INCLUDE,
    });
  }

  async deactivate(id: string) {
    const delegation = await this.prisma.approvalDelegation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!delegation) {
      throw new NotFoundException(`Delegation with ID ${id} not found`);
    }
    return this.prisma.approvalDelegation.update({
      where: { id },
      data: { active: false },
      include: DELEGATION_INCLUDE,
    });
  }
}
