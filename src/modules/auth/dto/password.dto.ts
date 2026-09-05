import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com'
  })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset token',
    example: 'reset-token-123'
  })
  @IsString()
  token!: string;

  @ApiProperty({
    description: 'New password',
    example: 'newpassword123'
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'currentpassword123'
  })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    description: 'New password',
    example: 'newpassword123'
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
