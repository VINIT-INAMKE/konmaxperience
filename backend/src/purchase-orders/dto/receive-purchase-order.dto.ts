import {
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveLineDto {
  @IsString()
  id: string; // PurchaseOrderLine id

  @IsNumber()
  @Min(0)
  received_quantity: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];
}
