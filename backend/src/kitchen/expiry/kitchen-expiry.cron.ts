import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KitchenExpiryCron {
  private readonly logger = new Logger(KitchenExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *') // Every hour at :00
  async handleExpiredPrepBatches() {
    try {
    // Find active batches where expires_at has passed
    // IMPORTANT: Only fetch where expires_at IS NOT NULL and < now()
    const expired = await this.prisma.withReconnect(() =>
      this.prisma.prepBatch.findMany({
        where: {
          status: 'active',
          expires_at: { not: null, lt: new Date() },
        },
        include: { recipe: { select: { computed_cost: true } } },
      })
    );

    this.logger.log(`Found ${expired.length} expired prep batches`);

    if (expired.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      // Batch update all expired batches in one query
      const expiredIds = expired.map((b) => b.id);
      await tx.prepBatch.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'expired' },
      });

      // Batch create waste logs for batches with remaining quantity
      const wasteLogs = expired
        .filter((batch) => Number(batch.quantity_remaining) > 0)
        .map((batch) => {
          const costImpact =
            Number(batch.recipe.computed_cost ?? 0) *
            (Number(batch.quantity_remaining) / Number(batch.quantity_produced));
          return {
            waste_type: 'prep_batch' as const,
            prep_batch_id: batch.id,
            quantity: batch.quantity_remaining,
            unit: batch.unit,
            reason: 'expired' as const,
            cost_impact: costImpact,
            logged_by: null as string | null, // System-generated -- logged_by is nullable per schema
            zone_id: batch.zone_id,
          };
        });

      if (wasteLogs.length > 0) {
        await tx.wasteLog.createMany({ data: wasteLogs });
      }
    });
    } catch (error) {
      this.logger.error(
        'handleExpiredPrepBatches failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
