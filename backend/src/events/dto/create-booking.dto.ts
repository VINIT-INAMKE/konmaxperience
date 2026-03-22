import { IsString, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  customer_name: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  customer_phone: string;

  @IsInt()
  @Min(1)
  @Max(50)
  guests: number;
}
