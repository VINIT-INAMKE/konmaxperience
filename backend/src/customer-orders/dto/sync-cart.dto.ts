import {
  IsArray,
  IsOptional,
  IsString,
  IsIn,
  IsUUID,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @IsUUID()
  menuItemId: string;

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
  @IsIn(['takeaway', 'delivery'])
  channel?: 'takeaway' | 'delivery';

  @IsOptional()
  @IsString()
  deliveryAddressId?: string;
}
