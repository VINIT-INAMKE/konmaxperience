import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CreateVendorPriceDto } from './dto/create-vendor-price.dto';
import { CostCalculatorService } from '../recipes/cost-calculator.service';

const VENDOR_INCLUDE = {
  VendorPrices: {
    include: { ingredient: { select: { id: true, name: true, base_unit: true } } },
    orderBy: { effective_date: 'desc' as const },
  },
} as const;

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costCalculatorService: CostCalculatorService,
  ) {}

  async findAll(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    return this.prisma.vendor.findMany({
      where,
      include: {
        _count: { select: { VendorPrices: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: VENDOR_INCLUDE,
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
    return vendor;
  }

  async create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        name: dto.name,
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.payment_terms !== undefined && { payment_terms: dto.payment_terms }),
      },
    });
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.payment_terms !== undefined && { payment_terms: dto.payment_terms }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: VENDOR_INCLUDE,
    });
  }

  async remove(id: string) {
    const [vendor, priceCount] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.vendorPrice.count({ where: { vendor_id: id } }),
    ]);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
    if (priceCount > 0) {
      throw new BadRequestException(
        `Cannot delete vendor — it has ${priceCount} price record(s). Remove the prices first.`,
      );
    }
    return this.prisma.vendor.delete({ where: { id } });
  }

  async addPrice(dto: CreateVendorPriceDto) {
    const result = await this.prisma.vendorPrice.create({
      data: {
        vendor_id: dto.vendor_id,
        ingredient_id: dto.ingredient_id,
        price: dto.price,
        unit: dto.unit,
        effective_date: new Date(dto.effective_date),
      },
      include: {
        ingredient: { select: { id: true, name: true, base_unit: true } },
        vendor: { select: { id: true, name: true } },
      },
    });
    await this.recalculateCostsForIngredient(dto.ingredient_id);
    return result;
  }

  async getPricesForIngredient(ingredientId: string) {
    return this.prisma.vendorPrice.findMany({
      where: { ingredient_id: ingredientId },
      include: {
        vendor: { select: { id: true, name: true } },
        ingredient: { select: { id: true, name: true, base_unit: true } },
      },
      orderBy: { effective_date: 'desc' },
      take: 100,
    });
  }

  async recalculateCostsForIngredient(ingredientId: string): Promise<void> {
    await this.costCalculatorService.recalculateForIngredient(ingredientId);
  }
}
