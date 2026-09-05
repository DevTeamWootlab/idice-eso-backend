import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Verification token',
    example: 'verification-token-123'
  })
  @IsString()
  token!: string;
}
