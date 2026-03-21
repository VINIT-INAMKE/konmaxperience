import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

const BRAND_INCLUDE = {
  owner: { select: { id: true, name: true } },
} as const;

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    return this.prisma.brand.findMany({
      where,
      include: BRAND_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: BRAND_INCLUDE,
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }
    return brand;
  }

  async create(dto: CreateBrandDto) {
    return this.prisma.brand.create({
      data: {
        name: dto.name,
        brand_type: dto.brand_type,
        ...(dto.owner_user_id !== undefined && { owner_user_id: dto.owner_user_id }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: BRAND_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateBrandDto, userId: string, isAdmin: boolean) {
    const brand = await this.findOne(id);

    const isOwner = brand.owner_user_id === userId;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Only admin or the brand owner can edit this brand');
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.brand_type !== undefined && { brand_type: dto.brand_type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.owner_user_id !== undefined && { owner_user_id: dto.owner_user_id }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: BRAND_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.brand.delete({ where: { id } });
  }
}
