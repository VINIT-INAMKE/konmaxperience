import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryDto {
  @IsOptional()
  @IsString()
  delivery_assigned_to?: string;

  @IsOptional()
  @IsIn(['picked_up', 'in_transit', 'delivered'])
  delivery_status?: string;
}
