import { IsUUID, IsNumber, Min } from 'class-validator';

export class CreatePrepBatchDto {
  @IsUUID()
  recipe_id: string;

  @IsUUID()
  zone_id: string;

  @IsNumber()
  @Min(0.001)
  quantity_to_prep: number;
}
