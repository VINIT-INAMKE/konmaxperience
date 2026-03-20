import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.readinessMeter.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async findTasksForMeter(meterId: string) {
    const meter = await this.prisma.readinessMeter.findUnique({
      where: { id: meterId },
    });

    if (!meter) {
      throw new NotFoundException(`Readiness meter with ID ${meterId} not found`);
    }

    return this.prisma.taskReadinessEvent.findMany({
      where: {
        readiness_meter_id: meterId,
        revoked_at: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            valid_xp: true,
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
