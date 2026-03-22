import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

const ASSET_INCLUDE = {
  creator: { select: { id: true, name: true } },
  linked_brand: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string, assetType?: string, page?: number, limit?: number) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (assetType) {
      where.asset_type = assetType;
    }

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    return this.prisma.asset.findMany({
      where,
      include: ASSET_INCLUDE,
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: ASSET_INCLUDE,
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return asset;
  }

  async create(dto: CreateAssetDto, createdBy: string) {
    return this.prisma.asset.create({
      data: {
        name: dto.name,
        asset_type: dto.asset_type,
        url: dto.url,
        created_by: createdBy,
        status: 'draft',
        ...(dto.linked_brand_id !== undefined && { linked_brand_id: dto.linked_brand_id }),
        ...(dto.linked_task_id !== undefined && { linked_task_id: dto.linked_task_id }),
      },
      include: ASSET_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateAssetDto, userId: string, isAdmin: boolean) {
    const asset = await this.findOne(id);

    const isCreator = asset.created_by === userId;
    if (!isAdmin && !isCreator) {
      throw new ForbiddenException('Only admin or the asset creator can edit this asset');
    }

    // Status transition guard: non-admin creators can only move draft -> in_review
    if (dto.status !== undefined && !isAdmin) {
      const CREATOR_ALLOWED_STATUSES = ['in_review'];
      if (!CREATOR_ALLOWED_STATUSES.includes(dto.status)) {
        throw new ForbiddenException(
          'Creators can only submit assets for review. Only admin can approve or reject.',
        );
      }
    }

    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.linked_brand_id !== undefined && { linked_brand_id: dto.linked_brand_id }),
        ...(dto.linked_task_id !== undefined && { linked_task_id: dto.linked_task_id }),
      },
      include: ASSET_INCLUDE,
    });
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const asset = await this.findOne(id);

    const isCreator = asset.created_by === userId;
    if (!isAdmin && !isCreator) {
      throw new ForbiddenException('Only admin or the asset creator can delete this asset');
    }

    return this.prisma.asset.delete({ where: { id } });
  }
}
