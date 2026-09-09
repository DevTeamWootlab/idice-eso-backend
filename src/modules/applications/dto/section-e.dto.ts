import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsString,
  IsEmail,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReferenceItemDto {
  @IsString()
  fullName!: string;

  @IsString()
  relationship!: string;

  @IsOptional()
  @IsString()
  organisationName?: string;

  @IsString()
  phoneNumber!: string;

  @IsEmail()
  email!: string;
}

export class SectionEDto {
  @IsArray()
  @ArrayMinSize(3) //minimum 3 verifiable references
  @ValidateNested({ each: true })
  @Type(() => ReferenceItemDto)
  references!: ReferenceItemDto[];
}
