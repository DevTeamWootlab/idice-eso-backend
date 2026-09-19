import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListNotificationsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class InAppNotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Application update' })
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Portal path to open' })
  href!: string | null;

  @ApiProperty()
  read!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class InAppNotificationListDto {
  @ApiProperty({ type: [InAppNotificationDto] })
  items!: InAppNotificationDto[];

  @ApiProperty({ description: 'Unread across all of the user\'s notifications, not just this page' })
  unreadCount!: number;
}

export class MarkedReadDto {
  @ApiProperty()
  marked!: number;
}
