import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { OrderChannel } from '@prisma/client';

export class CreateOrderItemDto {
  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  variant_id?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  item_notes?: string;
}

export class CreateOrderDto {
  @IsEnum(OrderChannel)
  channel: OrderChannel;

  @IsUUID()
  zone_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  table_number?: string;

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  delivery_address?: string;

  @IsOptional()
  @IsString()
  delivery_assigned_to?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
