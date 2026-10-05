// src/modules/health/dto/health-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export enum HealthStatus {
  HEALTHY = 'UP',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'DOWN',
}

export class HealthResponseDto {
  @ApiProperty({ enum: HealthStatus, example: HealthStatus.HEALTHY })
  @IsEnum(HealthStatus)
  status: HealthStatus = HealthStatus.HEALTHY;

  @ApiProperty({ example: '2026-09-03T16:45:00.000Z' })
  @IsString()
  @IsNotEmpty()
  timestamp: string = new Date().toISOString();

  @ApiProperty({ example: true })
  @IsBoolean()
  database_connected: boolean = false;

  @ApiProperty({ example: false })
  @IsBoolean()
  migrations_pending: boolean = false;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @IsNotEmpty()
  version: string = '1.0.0';
}
