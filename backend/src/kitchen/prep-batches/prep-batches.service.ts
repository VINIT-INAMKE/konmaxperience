import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrepBatchDto } from './dto/create-prep-batch.dto';
import { PreviewDeductionsDto } from './dto/preview-deductions.dto';

@Injectable()
export class PrepBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(zoneId?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (zoneId) where.zone_id = zoneId;
    if (status) where.status = status;

    return this.prisma.prepBatch.findMany({
      where,
      include: {
        recipe: {
          select: {
            name: true,
            yield_unit: true,
            shelf_life_hours: true,
            computed_cost: true,
          },
        },
        zone: { select: { name: true } },
        creator: { select: { name: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async createPrepBatch(
    _dto: CreatePrepBatchDto,
    _userId: string,
  ): Promise<any> {
    // Stub — implemented in Task 2
    throw new BadRequestException('createPrepBatch not yet implemented');
  }

  async previewDeductions(_dto: PreviewDeductionsDto): Promise<any[]> {
    // Stub — implemented in Task 2
    throw new BadRequestException('previewDeductions not yet implemented');
  }
}
