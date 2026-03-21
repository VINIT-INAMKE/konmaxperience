import { IsOptional, IsString, Matches } from 'class-validator';

export class AnalyticsQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;
}

export class WinsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  limit?: string; // parsed to number in service, default 20
}
