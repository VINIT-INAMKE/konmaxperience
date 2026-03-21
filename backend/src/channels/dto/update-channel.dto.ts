import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['dine_in', 'delivery', 'takeaway', 'retail', 'event', 'workshop', 'online'])
  channel_type?: string;

  @IsOptional()
  @IsIn(['planned', 'active', 'inactive'])
  status?: string;
}
