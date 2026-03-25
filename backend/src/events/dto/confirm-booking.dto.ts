import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class ConfirmBookingDto {
  @IsString()
  razorpay_order_id: string;

  @IsString()
  razorpay_payment_id: string;

  @IsString()
  razorpay_signature: string;

  @IsInt()
  @Min(1)
  guests: number;

  @IsOptional()
  @IsString()
  customer_name?: string;
}
