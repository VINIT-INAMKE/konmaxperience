import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
