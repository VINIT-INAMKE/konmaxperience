import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CreateVendorPriceDto } from './dto/create-vendor-price.dto';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.vendorsService.findAll(status);
  }

  @Get('prices/ingredient/:ingredientId')
  async getPricesForIngredient(
    @Param('ingredientId', ParseUUIDPipe) ingredientId: string,
  ) {
    return this.vendorsService.getPricesForIngredient(ingredientId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(@Body() dto: CreateVendorDto) {
    return this.vendorsService.create(dto);
  }

  @Post('prices')
  @RequiresPermission(Permission.MANAGE_OPS)
  async addPrice(@Body() dto: CreateVendorPriceDto) {
    return this.vendorsService.addPrice(dto);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.update(id, dto);
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.remove(id);
  }
}
