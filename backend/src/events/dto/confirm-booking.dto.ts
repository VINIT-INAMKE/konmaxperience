import { IsString, IsOptional } from 'class-validator';

export class ConfirmBookingDto {
  @IsString()
  razorpay_order_id: string;

  @IsString()
  razorpay_payment_id: string;

  @IsString()
  razorpay_signature: string;

  @IsOptional()
  @IsString()
  customer_name?: string;
}
