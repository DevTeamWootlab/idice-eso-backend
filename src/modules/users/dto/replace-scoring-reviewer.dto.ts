import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NewScoringReviewerDto {
  @ApiProperty({ example: 'new.reviewer@wootlab.ng' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Amaka Obi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({
    description: 'Initial password. Leave out to have the server generate a temporary one, returned once.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class ReplaceScoringReviewerDto {
  @ApiPropertyOptional({
    description: 'Create a new Scoring Reviewer account as the replacement. Use this or replacementUserId.',
    type: NewScoringReviewerDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewScoringReviewerDto)
  newReviewer?: NewScoringReviewerDto;

  @ApiPropertyOptional({
    description: 'An existing, currently suspended Scoring Reviewer account to bring back as the replacement.',
  })
  @IsOptional()
  @IsUUID()
  replacementUserId?: string;

  @ApiPropertyOptional({ example: 'Could not complete two-factor setup; work handed to a new reviewer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ default: false, description: 'Email the new account its sign-in details.' })
  @IsOptional()
  @IsBoolean()
  sendCredentialsEmail?: boolean;
}

export class TransferScoringWorkDto {
  @ApiProperty({ description: 'Active Scoring Reviewer who takes over every unscored assignment.' })
  @IsUUID()
  incomingReviewerId!: string;

  @ApiPropertyOptional({ example: 'Reviewer left the programme' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
