import { IsString, MinLength } from 'class-validator';

export class BlockTaskDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
