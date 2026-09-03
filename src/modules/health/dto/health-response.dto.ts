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
  status: HealthStatus = HealthStatus.HEALTHY; // Initialize directly on the line

  @ApiProperty({ example: '2026-09-03T16:45:00.000Z' })
  @IsString()
  @IsNotEmpty()
  timestamp: string = new Date().toISOString(); // Initialize directly on the line

  @ApiProperty({ example: true })
  @IsBoolean()
  database_connected: boolean = false; // Initialize directly on the line

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @IsNotEmpty()
  version: string = '1.0.0'; // Initialize directly on the line
}
