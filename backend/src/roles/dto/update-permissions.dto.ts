import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class UpdatePermissionsDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  permissions!: string[];
}
