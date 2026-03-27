import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PickAndPackService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveOrders() {
    // Fetch orders that have at least one non-scratch item not yet complete
    // Order status: NOT in ['ready', 'delivered', 'cancelled']
    const orders = await this.prisma.order.findMany({
      where: {
        status: { notIn: ['ready', 'delivered', 'cancelled'] },
        items: {
          some: {
            menu_item: {
              recipe: {
                preparation_type: { not: 'scratch' },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
      include: {
        items: {
          where: {
            menu_item: {
              recipe: {
                preparation_type: { not: 'scratch' },
              },
            },
          },
          include: {
            menu_item: {
              select: {
                id: true,
                name: true,
                recipe: {
                  select: {
                    id: true,
                    name: true,
                    preparation_type: true,
                    RecipeLines: {
                      where: { input_type: 'recipe' },
                      select: {
                        source_recipe: {
                          select: { id: true, name: true },
                        },
                        quantity: true,
                        unit: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    // Transform to Pick & Pack response shape
    return orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer?.name ?? order.customer_name ?? null,
      created_at: order.created_at,
      channel: order.channel,
      items: order.items.map((item) => ({
        id: item.id,
        status: item.status,
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item?.name ?? '',
        quantity: item.quantity,
        item_notes: item.item_notes ?? null,
        preparation_type:
          item.menu_item?.recipe?.preparation_type ?? 'scratch',
        // For assemble items, include component checklist
        components:
          item.menu_item?.recipe?.preparation_type === 'assemble'
            ? (item.menu_item.recipe.RecipeLines ?? []).map((line) => ({
                recipe_id: line.source_recipe?.id ?? '',
                recipe_name: line.source_recipe?.name ?? '',
                quantity: Number(line.quantity),
                unit: line.unit,
              }))
            : undefined,
      })),
    }));
  }

  async markItemPicked(itemId: string) {
    // Mark a non-scratch order item as physically picked
    // Sets ready_at timestamp to record when the item was picked
    return this.prisma.orderItem.update({
      where: { id: itemId },
      data: { ready_at: new Date() },
    });
  }
}
