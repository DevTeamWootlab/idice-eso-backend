import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/common/enums/role.enum';

export class MeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'reviewer@wootlab.ng' })
  email!: string;

  @ApiProperty({ example: 'Ada Obi' })
  fullName!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Set for validators: the state they are scoped to',
    example: 'BENUE',
  })
  assignedState!: string | null;

  @ApiProperty({ description: 'Whether an authenticator app is enrolled' })
  mfaEnabled!: boolean;

  @ApiProperty()
  isEmailVerified!: boolean;
}
