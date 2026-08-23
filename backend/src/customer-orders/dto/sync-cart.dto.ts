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
import { FulfilmentType, OrderChannel } from '@prisma/client';

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

  /**
   * Whatever the client last cached. Read for error messages only — the server
   * re-prices every line from `Product.base_price` (`CHK-01`) and the response
   * carries the price that will actually be charged.
   */
  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  /**
   * A client may echo back the routing it was told last time so an offline cart
   * can render the right badge. The server **always** overwrites it from
   * `Product.fulfilment` (decision 6); it is never persisted from the body.
   */
  @IsOptional()
  @IsEnum(FulfilmentType)
  fulfilment?: FulfilmentType;
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
