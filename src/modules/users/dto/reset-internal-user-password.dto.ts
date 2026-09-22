import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResetInternalUserPasswordDto {
  @ApiPropertyOptional({
    description:
      'Off by default. When true, the email address and newly generated password are sent directly ' +
      'to the user via email, in addition to being shown once to the administrator triggering the reset.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sendCredentialsEmail?: boolean;
}
