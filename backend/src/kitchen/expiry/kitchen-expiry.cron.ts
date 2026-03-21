import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KitchenExpiryCron {
  private readonly logger = new Logger(KitchenExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *') // Every hour at :00
  async handleExpiredPrepBatches() {
    // Find active batches where expires_at has passed
    // IMPORTANT: Only fetch where expires_at IS NOT NULL and < now()
    const expired = await this.prisma.prepBatch.findMany({
      where: {
        status: 'active',
        expires_at: { not: null, lt: new Date() },
      },
      include: { recipe: true },
    });

    this.logger.log(`Found ${expired.length} expired prep batches`);

    for (const batch of expired) {
      await this.prisma.$transaction(async (tx) => {
        await tx.prepBatch.update({
          where: { id: batch.id },
          data: { status: 'expired' },
        });

        if (Number(batch.quantity_remaining) > 0) {
          const costImpact =
            Number(batch.recipe.computed_cost ?? 0) *
            (Number(batch.quantity_remaining) / Number(batch.quantity_produced));

          await tx.wasteLog.create({
            data: {
              waste_type: 'prep_batch',
              prep_batch_id: batch.id,
              quantity: batch.quantity_remaining,
              unit: batch.unit,
              reason: 'expired',
              cost_impact: costImpact,
              logged_by: null, // System-generated -- logged_by is nullable per schema
              zone_id: batch.zone_id,
            },
          });
        }
      });
    }
  }
}
