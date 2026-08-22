import { IsEnum, IsIn, IsNumber, Min, Max } from 'class-validator';
import { OrderChannel } from '@prisma/client';

export class UpsertChannelModifierDto {
  @IsEnum(OrderChannel)
  channel!: OrderChannel;

  @IsIn(['fixed', 'percentage'])
  modifier_type!: string;

  @IsNumber()
  @Min(-100)
  @Max(1000)
  modifier_value!: number;
}
