import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'true to reactivate, false to suspend the account', example: false })
  @IsBoolean()
  isActive!: boolean;
}
