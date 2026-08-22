import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';

export class UpdateDeliveryDto {
  @IsOptional()
  @IsString()
  delivery_assigned_to?: string;

  @IsOptional()
  @IsEnum(DeliveryStatus)
  delivery_status?: DeliveryStatus;
}
