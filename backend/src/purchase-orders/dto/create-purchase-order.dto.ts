import {
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsIn,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderLineDto {
  @IsUUID()
  ingredient_id: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsNumber()
  @Min(0)
  unit_cost: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  vendor_id: string;

  @IsUUID()
  zone_id: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsIn(['draft', 'ordered'])
  @IsOptional()
  status?: string;

  @IsOptional()
  @IsString()
  linked_task_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines: PurchaseOrderLineDto[];
}
