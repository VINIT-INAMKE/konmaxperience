import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsIn,
} from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsIn(['direct', 'group'])
  type: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participant_ids: string[];
}
