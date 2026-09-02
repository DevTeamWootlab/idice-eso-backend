import { ApiProperty } from '@nestjs/swagger';

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  DOWN = 'down',
}

/**
 * Mirrors the JSON Schema in the ticket's Technical Notes exactly:
 * required: status, timestamp, database_connected, version.
 */
export class HealthResponseDto {
  @ApiProperty({ enum: HealthStatus, example: HealthStatus.HEALTHY })
  status: HealthStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-01T12:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({ type: Boolean, example: true })
  database_connected: boolean;

  @ApiProperty({ type: String, example: '0.1.0' })
  version: string;
}
