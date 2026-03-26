import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerOrdersService } from './customer-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../customer-auth/redis.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PusherService } from '../chat/pusher.service';

describe('CustomerOrdersService', () => {
  let service: CustomerOrdersService;
  let prisma: Record<string, any>;
  let redisClient: Record<string, jest.Mock>;
  let redisService: { getClient: jest.Mock };
  let razorpayService: Record<string, jest.Mock>;
  let pusherService: { trigger: jest.Mock };

  const customerId = 'cust-001';

  beforeEach(async () => {
    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    };

    prisma = {
      customerAddress: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      menuItem: {
        findMany: jest.fn(),
      },
      channelModifier: {
        findFirst: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      eventBooking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    razorpayService = {
      createOrder: jest.fn(),
      verifyPaymentSignature: jest.fn(),
      fetchPayment: jest.fn(),
    };

    pusherService = {
      trigger: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
        { provide: RazorpayService, useValue: razorpayService },
        { provide: PusherService, useValue: pusherService },
      ],
    }).compile();

    service = module.get<CustomerOrdersService>(CustomerOrdersService);
  });

  // ---------------------------------------------------------------
  // Cart CRUD
  // ---------------------------------------------------------------

  describe('getCart', () => {
    it('should return parsed cart from Redis', async () => {
      const cart = {
        items: [{ menuItemId: 'm1', name: 'Burger', quantity: 2, unitPrice: 150, imageUrl: null }],
        channel: 'takeaway',
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(cart));

      const result = await service.getCart(customerId);
      expect(result).toEqual(cart);
      expect(redisClient.get).toHaveBeenCalledWith(`cart:${customerId}`);
    });

    it('should return null when key missing', async () => {
      redisClient.get.mockResolvedValue(null);
      const result = await service.getCart(customerId);
      expect(result).toBeNull();
    });

    it('should return null when Redis client unavailable', async () => {
      redisService.getClient.mockReturnValue(null);
      const result = await service.getCart(customerId);
      expect(result).toBeNull();
    });
  });

  describe('setCart', () => {
    it('should call redis.set with correct key and TTL', async () => {
      const cart = {
        items: [],
        channel: null as any,
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      await service.setCart(customerId, cart);
      expect(redisClient.set).toHaveBeenCalledWith(
        `cart:${customerId}`,
        JSON.stringify(cart),
        'EX',
        604800,
      );
    });
  });

  describe('deleteCart', () => {
    it('should call redis.del with correct key', async () => {
      await service.deleteCart(customerId);
      expect(redisClient.del).toHaveBeenCalledWith(`cart:${customerId}`);
    });
  });

  describe('syncCart', () => {
    it('should keep Redis cart when it has more items', async () => {
      const existing = {
        items: [
          { menuItemId: 'm1', name: 'A', quantity: 1, unitPrice: 100, imageUrl: null },
          { menuItemId: 'm2', name: 'B', quantity: 1, unitPrice: 200, imageUrl: null },
        ],
        channel: 'takeaway' as const,
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(existing));

      const local = {
        items: [{ menuItemId: 'm1', name: 'A', quantity: 1, unitPrice: 100 }],
        channel: 'takeaway' as const,
        deliveryAddressId: null,
      };

      const result = await service.syncCart(customerId, local as any);
      expect(result.items).toHaveLength(2);
    });

    it('should keep local cart when it has more items', async () => {
      const existing = {
        items: [{ menuItemId: 'm1', name: 'A', quantity: 1, unitPrice: 100, imageUrl: null }],
        channel: 'takeaway' as const,
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(existing));

      const local = {
        items: [
          { menuItemId: 'm1', name: 'A', quantity: 1, unitPrice: 100 },
          { menuItemId: 'm2', name: 'B', quantity: 1, unitPrice: 200 },
          { menuItemId: 'm3', name: 'C', quantity: 1, unitPrice: 300 },
        ],
        channel: 'delivery' as const,
        deliveryAddressId: 'addr-1',
      };

      const result = await service.syncCart(customerId, local as any);
      expect(result.items).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------
  // Serviceability
  // ---------------------------------------------------------------

  describe('isServiceable', () => {
    const originalEnv = process.env.DELIVERY_PINCODES;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.DELIVERY_PINCODES;
      } else {
        process.env.DELIVERY_PINCODES = originalEnv;
      }
    });

    it('should return true when DELIVERY_PINCODES not set', () => {
      delete process.env.DELIVERY_PINCODES;
      expect(service.isServiceable('560001')).toBe(true);
    });

    it('should return true for listed pincode', () => {
      process.env.DELIVERY_PINCODES = '560001,560002,560003';
      expect(service.isServiceable('560001')).toBe(true);
    });

    it('should return false for unlisted pincode', () => {
      process.env.DELIVERY_PINCODES = '560001,560002,560003';
      expect(service.isServiceable('999999')).toBe(false);
    });

    it('should handle whitespace in env var', () => {
      process.env.DELIVERY_PINCODES = ' 560001 , 560002 ';
      expect(service.isServiceable('560001')).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // checkoutCart
  // ---------------------------------------------------------------

  describe('checkoutCart', () => {
    it('should throw if cart is empty', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({ items: [], channel: null, deliveryAddressId: null, updatedAt: '' }),
      );
      await expect(service.checkoutCart(customerId)).rejects.toThrow(BadRequestException);
    });

    it('should throw if cart is null', async () => {
      redisClient.get.mockResolvedValue(null);
      await expect(service.checkoutCart(customerId)).rejects.toThrow(BadRequestException);
    });

    it('should throw for delivery with non-serviceable pincode', async () => {
      process.env.DELIVERY_PINCODES = '560001';

      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items: [{ menuItemId: 'm1', name: 'A', quantity: 1, unitPrice: 100, imageUrl: null }],
          channel: 'delivery',
          deliveryAddressId: 'addr-1',
          updatedAt: '',
        }),
      );

      prisma.customerAddress.findFirst.mockResolvedValue({
        id: 'addr-1',
        customer_id: customerId,
        pincode: '999999',
        address: '123 Test St',
      });

      await expect(service.checkoutCart(customerId)).rejects.toThrow(
        "Sorry, we don't deliver to this pincode yet",
      );

      delete process.env.DELIVERY_PINCODES;
    });

    it('should create Razorpay order with server-side prices and marketplace notes', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items: [{ menuItemId: 'm1', name: 'Burger', quantity: 2, unitPrice: 999, imageUrl: null }],
          channel: 'takeaway',
          deliveryAddressId: null,
          updatedAt: '',
        }),
      );

      // Server price is 150, not the untrusted cart price of 999
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'm1', base_price: 150 },
      ]);
      prisma.channelModifier.findFirst.mockResolvedValue(null);

      razorpayService.createOrder.mockResolvedValue({ id: 'order_rzp123' });

      const result = await service.checkoutCart(customerId);

      expect(result.razorpay_order_id).toBe('order_rzp123');
      // Verify server-side price (150 * 2 = 300, * 100 = 30000 paise)
      expect(razorpayService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 30000,
          notes: { type: 'marketplace', entity_id: customerId },
        }),
      );
      // Verify pending order stored in Redis
      expect(redisClient.set).toHaveBeenCalledWith(
        'pending_order:order_rzp123',
        expect.any(String),
        'EX',
        1800,
      );
    });

    it('should throw when menu item no longer available', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items: [{ menuItemId: 'm1', name: 'Gone Item', quantity: 1, unitPrice: 100, imageUrl: null }],
          channel: 'takeaway',
          deliveryAddressId: null,
          updatedAt: '',
        }),
      );

      prisma.menuItem.findMany.mockResolvedValue([]); // no items found

      await expect(service.checkoutCart(customerId)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------
  // confirmOrder
  // ---------------------------------------------------------------

  describe('confirmOrder', () => {
    const dto = {
      razorpay_order_id: 'order_rzp123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'sig_123',
    };

    const pendingData = {
      customerId,
      cart: {
        items: [{ menuItemId: 'm1', name: 'Burger', quantity: 2, unitPrice: 150, imageUrl: null }],
        channel: 'takeaway',
        deliveryAddressId: null,
      },
      subtotal: 300,
      modifierAmount: 0,
      total: 300,
      channel: 'takeaway',
      deliveryAddressId: null,
    };

    it('should verify signature, create order, delete cart, trigger Pusher', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(pendingData));
      razorpayService.verifyPaymentSignature.mockReturnValue(true);
      razorpayService.fetchPayment.mockResolvedValue({
        status: 'captured',
        amount: 30000,
      });

      const createdOrder = {
        id: 'ord-1',
        order_number: 42,
        status: 'placed',
        items: [],
        payment: { id: 'pay-1' },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        // Simulate the transaction by providing a mock tx with order.create
        const tx = {
          order: { create: jest.fn().mockResolvedValue(createdOrder) },
        };
        return fn(tx);
      });

      const result = await service.confirmOrder(customerId, dto);

      expect(result).toEqual(createdOrder);
      expect(razorpayService.verifyPaymentSignature).toHaveBeenCalledWith(
        dto.razorpay_order_id,
        dto.razorpay_payment_id,
        dto.razorpay_signature,
      );
      // Redis cleanup
      expect(redisClient.del).toHaveBeenCalledWith('pending_order:order_rzp123');
      expect(redisClient.del).toHaveBeenCalledWith(`cart:${customerId}`);
      // Pusher trigger
      expect(pusherService.trigger).toHaveBeenCalledWith(
        `private-customer-${customerId}`,
        'order.placed',
        expect.objectContaining({ orderId: 'ord-1', status: 'placed' }),
      );
    });

    it('should throw ForbiddenException when customerId mismatch', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({ ...pendingData, customerId: 'other-customer' }),
      );

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw when payment signature invalid', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(pendingData));
      razorpayService.verifyPaymentSignature.mockReturnValue(false);

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when pending order not found', async () => {
      redisClient.get.mockResolvedValue(null);

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------
  // getOrderById
  // ---------------------------------------------------------------

  describe('getOrderById', () => {
    it('should return order when customer_id matches', async () => {
      const order = {
        id: 'ord-1',
        customer_id: customerId,
        items: [],
        payment: null,
      };
      prisma.order.findUnique.mockResolvedValue(order);

      const result = await service.getOrderById(customerId, 'ord-1');
      expect(result).toEqual(order);
    });

    it('should throw ForbiddenException when customer_id mismatch', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: 'other-customer',
        items: [],
      });

      await expect(
        service.getOrderById(customerId, 'ord-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById(customerId, 'ord-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // Address CRUD
  // ---------------------------------------------------------------

  describe('createAddress', () => {
    it('should set is_default=true for first address', async () => {
      prisma.customerAddress.count.mockResolvedValue(0);
      prisma.customerAddress.create.mockResolvedValue({ id: 'addr-1', is_default: true });

      const result = await service.createAddress(customerId, {
        label: 'Home',
        address: '123 Main St',
        pincode: '560001',
      } as any);

      expect(prisma.customerAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_default: true }),
        }),
      );
    });

    it('should not set is_default for subsequent addresses', async () => {
      prisma.customerAddress.count.mockResolvedValue(2);
      prisma.customerAddress.create.mockResolvedValue({ id: 'addr-2', is_default: false });

      await service.createAddress(customerId, {
        label: 'Work',
        address: '456 Office Blvd',
        pincode: '560002',
      } as any);

      expect(prisma.customerAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_default: false }),
        }),
      );
    });
  });

  describe('listAddresses', () => {
    it('should return addresses for customer', async () => {
      const addresses = [
        { id: 'addr-1', is_default: true },
        { id: 'addr-2', is_default: false },
      ];
      prisma.customerAddress.findMany.mockResolvedValue(addresses);

      const result = await service.listAddresses(customerId);
      expect(result).toEqual(addresses);
      expect(prisma.customerAddress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customer_id: customerId },
        }),
      );
    });
  });

  describe('deleteAddress', () => {
    it('should promote next address when deleting default', async () => {
      prisma.customerAddress.findFirst
        .mockResolvedValueOnce({ id: 'addr-1', is_default: true, customer_id: customerId })
        .mockResolvedValueOnce({ id: 'addr-2', is_default: false });
      prisma.customerAddress.delete.mockResolvedValue({});
      prisma.customerAddress.update.mockResolvedValue({});

      await service.deleteAddress(customerId, 'addr-1');

      expect(prisma.customerAddress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'addr-2' },
          data: { is_default: true },
        }),
      );
    });

    it('should throw NotFoundException for non-existent address', async () => {
      prisma.customerAddress.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAddress(customerId, 'addr-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // Receipt generation
  // ---------------------------------------------------------------

  describe('generateOrderReceipt', () => {
    it('should throw ForbiddenException when customer_id mismatch', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: 'other-customer',
        items: [],
      });

      await expect(
        service.generateOrderReceipt(customerId, 'ord-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.generateOrderReceipt(customerId, 'ord-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return HTML string for valid order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: customerId,
        order_number: 42,
        channel: 'takeaway',
        created_at: new Date('2026-01-15T10:00:00Z'),
        subtotal: 300,
        channel_modifier_amount: 0,
        total: 300,
        delivery_address: null,
        items: [
          { menu_item: { name: 'Burger' }, quantity: 2, unit_price: 150 },
        ],
        payment: { method: 'razorpay', razorpay_payment_id: 'pay_123' },
        customer: { name: 'Test User', phone: '9876543210' },
      });

      const html = await service.generateOrderReceipt(customerId, 'ord-1');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Konma Xperience');
      expect(html).toContain('#42');
      expect(html).toContain('Burger');
    });
  });

  describe('generateBookingReceipt', () => {
    it('should throw ForbiddenException when customer_id mismatch', async () => {
      prisma.eventBooking.findUnique.mockResolvedValue({
        id: 'book-1',
        customer_id: 'other-customer',
      });

      await expect(
        service.generateBookingReceipt(customerId, 'book-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
