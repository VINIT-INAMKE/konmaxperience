import { IsOptional, IsString, IsIn } from 'class-validator';

export class OrderFiltersDto {
  @IsOptional()
  @IsIn(['dine_in', 'takeaway', 'delivery'])
  channel?: string;

  @IsOptional()
  @IsIn(['placed', 'preparing', 'ready', 'served', 'dispatched', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
