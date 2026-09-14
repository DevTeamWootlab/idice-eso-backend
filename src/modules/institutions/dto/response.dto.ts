import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNumber, IsBoolean, IsEnum } from "class-validator";
import { HubType } from "../entities/institution.entity";

export class InstitutionResponseDto {
  @ApiProperty({ description: 'Institution ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Institution name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Institution state' })
  @IsString()
  state!: string;

  @ApiProperty({ description: 'Hub Type' })
  @IsEnum(HubType)
  hubType!: HubType;

  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  latitude!: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  longitude!: number;

  @ApiProperty({ description: 'Beneficiary capacity' })
  @IsNumber()
  beneficiaryCapacity!: number;

  @ApiProperty({ description: 'Is active' })
  @IsBoolean()
  isActive!: boolean;
}


