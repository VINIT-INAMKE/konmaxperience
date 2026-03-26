import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../customer-auth/redis.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SyncCartDto } from './dto/sync-cart.dto';

// ---------------------------------------------------------------
// Cart data shape (stored as JSON in Redis)
// ---------------------------------------------------------------
export interface CartData {
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    imageUrl: string | null;
  }>;
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
  updatedAt: string;
}

const CART_TTL = 604800; // 7 days in seconds

@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // ---------------------------------------------------------------
  // Cart — Redis CRUD
  // ---------------------------------------------------------------

  private cartKey(customerId: string): string {
    return `cart:${customerId}`;
  }

  async getCart(customerId: string): Promise<CartData | null> {
    const redis = this.redisService.getClient();
    if (!redis) return null;

    const raw = await redis.get(this.cartKey(customerId));
    if (!raw) return null;

    return JSON.parse(raw) as CartData;
  }

  async setCart(customerId: string, cart: CartData): Promise<void> {
    const redis = this.redisService.getClient();
    if (!redis) return;

    await redis.set(
      this.cartKey(customerId),
      JSON.stringify(cart),
      'EX',
      CART_TTL,
    );
  }

  async deleteCart(customerId: string): Promise<void> {
    const redis = this.redisService.getClient();
    if (!redis) return;

    await redis.del(this.cartKey(customerId));
  }

  async syncCart(
    customerId: string,
    localCart: SyncCartDto,
  ): Promise<CartData> {
    const existing = await this.getCart(customerId);

    let merged: CartData;

    if (existing && existing.items.length > 0 && localCart.items.length > 0) {
      // Both have items — keep the one with more items
      if (existing.items.length >= localCart.items.length) {
        merged = existing;
      } else {
        merged = {
          items: localCart.items.map((i) => ({
            menuItemId: i.menuItemId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            imageUrl: i.imageUrl ?? null,
          })),
          channel: localCart.channel ?? null,
          deliveryAddressId: localCart.deliveryAddressId ?? null,
          updatedAt: new Date().toISOString(),
        };
      }
    } else if (localCart.items.length > 0) {
      // Only local cart has items
      merged = {
        items: localCart.items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          imageUrl: i.imageUrl ?? null,
        })),
        channel: localCart.channel ?? null,
        deliveryAddressId: localCart.deliveryAddressId ?? null,
        updatedAt: new Date().toISOString(),
      };
    } else if (existing) {
      // Only Redis cart has items (or both empty)
      merged = existing;
    } else {
      // Both empty
      merged = {
        items: [],
        channel: localCart.channel ?? null,
        deliveryAddressId: localCart.deliveryAddressId ?? null,
        updatedAt: new Date().toISOString(),
      };
    }

    await this.setCart(customerId, merged);
    return merged;
  }

  // ---------------------------------------------------------------
  // Address CRUD
  // ---------------------------------------------------------------

  async createAddress(customerId: string, dto: CreateAddressDto) {
    // Check if customer has any existing addresses
    const existingCount = await this.prisma.customerAddress.count({
      where: { customer_id: customerId },
    });

    const isDefault = existingCount === 0;

    // If this address is being set as default, unset other defaults first
    if (isDefault && existingCount > 0) {
      await this.prisma.customerAddress.updateMany({
        where: { customer_id: customerId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.customerAddress.create({
      data: {
        customer_id: customerId,
        label: dto.label,
        address: dto.address,
        landmark: dto.landmark,
        pincode: dto.pincode,
        lat: dto.lat,
        lng: dto.lng,
        is_default: isDefault,
      },
    });
  }

  async listAddresses(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customer_id: customerId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.landmark !== undefined && { landmark: dto.landmark }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
      },
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.customerAddress.delete({ where: { id: addressId } });

    // If we deleted the default address, promote the next oldest
    if (address.is_default) {
      const next = await this.prisma.customerAddress.findFirst({
        where: { customer_id: customerId },
        orderBy: { created_at: 'asc' },
      });
      if (next) {
        await this.prisma.customerAddress.update({
          where: { id: next.id },
          data: { is_default: true },
        });
      }
    }
  }

  async setDefaultAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Unset all other defaults
    await this.prisma.customerAddress.updateMany({
      where: { customer_id: customerId, is_default: true },
      data: { is_default: false },
    });

    // Set this one as default
    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data: { is_default: true },
    });
  }
}
