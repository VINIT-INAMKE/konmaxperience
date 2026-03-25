import { IsInt, Min } from 'class-validator';

export class CheckoutEventDto {
  @IsInt()
  @Min(1)
  guests: number;
}
