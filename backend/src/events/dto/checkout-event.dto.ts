import { IsInt, Min, Max } from 'class-validator';

export class CheckoutEventDto {
  @IsInt()
  @Min(1)
  @Max(50)
  guests: number;
}
