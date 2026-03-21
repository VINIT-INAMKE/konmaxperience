import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

const ZONE_INCLUDE = {
  owner: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.zone.findMany({
      include: ZONE_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: ZONE_INCLUDE,
    });
    if (!zone) {
      throw new NotFoundException(`Zone with ID ${id} not found`);
    }
    return zone;
  }

  async create(dto: CreateZoneDto) {
    return this.prisma.zone.create({
      data: {
        name: dto.name,
        zone_type: dto.zone_type,
        ...(dto.owner_user_id !== undefined && { owner_user_id: dto.owner_user_id }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: ZONE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateZoneDto, userId: string, isAdmin: boolean) {
    const zone = await this.findOne(id);

    const isOwner = zone.owner_user_id === userId;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Only admin or the zone owner can edit this zone');
    }

    return this.prisma.zone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.zone_type !== undefined && { zone_type: dto.zone_type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.owner_user_id !== undefined && { owner_user_id: dto.owner_user_id }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: ZONE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.zone.delete({ where: { id } });
  }
}
