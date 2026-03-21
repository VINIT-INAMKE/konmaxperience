import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['dine_in', 'delivery', 'takeaway', 'retail', 'event', 'workshop', 'online'])
  channel_type: string;
}
