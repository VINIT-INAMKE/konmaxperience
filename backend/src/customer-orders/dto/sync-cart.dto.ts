import {
  IsArray,
  IsOptional,
  IsString,
  IsEnum,
  IsIn,
  IsUUID,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderChannel } from '@prisma/client';

export class CartItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}

export class SyncCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsOptional()
  @IsEnum(OrderChannel)
  @IsIn([OrderChannel.takeaway, OrderChannel.delivery])
  channel?: OrderChannel;

  @IsOptional()
  @IsString()
  deliveryAddressId?: string;
}
