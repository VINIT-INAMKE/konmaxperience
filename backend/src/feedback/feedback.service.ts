import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackFiltersDto } from './dto/feedback-filters.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: CreateFeedbackDto) {
    // If order_id provided, verify order exists
    if (dto.order_id) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.order_id },
      });
      if (!order) {
        throw new NotFoundException(
          `Order with ID ${dto.order_id} not found`,
        );
      }
    }

    return this.prisma.feedback.create({
      data: {
        order_id: dto.order_id,
        rating: dto.rating,
        comment: dto.comment,
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
      },
    });
  }

  async findAll(filters: FeedbackFiltersDto) {
    const where: Record<string, unknown> = {};

    if (filters.rating) {
      where.rating = filters.rating;
    }

    if (filters.date_from || filters.date_to) {
      const createdAt: Record<string, unknown> = {};
      if (filters.date_from) {
        createdAt.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        createdAt.lte = new Date(filters.date_to);
      }
      where.created_at = createdAt;
    }

    return this.prisma.feedback.findMany({
      where,
      include: { order: { select: { id: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async getStats() {
    const result = await this.prisma.feedback.aggregate({
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      average_rating: result._avg.rating
        ? Math.round(result._avg.rating * 10) / 10
        : 0,
      total_count: result._count.id,
    };
  }
}
