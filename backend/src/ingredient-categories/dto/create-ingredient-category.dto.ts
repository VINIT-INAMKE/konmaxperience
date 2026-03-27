import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateIngredientCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
