import { IsString, IsIn, IsNumber } from 'class-validator';

export class UpsertChannelModifierDto {
  @IsString()
  @IsIn(['dine_in', 'takeaway', 'delivery'])
  channel_type!: string;

  @IsIn(['fixed', 'percentage'])
  modifier_type!: string;

  @IsNumber()
  modifier_value!: number;
}
