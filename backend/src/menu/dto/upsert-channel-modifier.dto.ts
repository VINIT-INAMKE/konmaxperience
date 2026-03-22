import { IsString, IsIn, IsNumber, Min, Max } from 'class-validator';

export class UpsertChannelModifierDto {
  @IsString()
  @IsIn(['dine_in', 'takeaway', 'delivery', 'retail', 'event', 'workshop', 'online'])
  channel_type!: string;

  @IsIn(['fixed', 'percentage'])
  modifier_type!: string;

  @IsNumber()
  @Min(-100)
  @Max(1000)
  modifier_value!: number;
}
