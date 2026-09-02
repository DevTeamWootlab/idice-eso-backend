import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthResponseDto, HealthStatus } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<HealthResponseDto> {
    const databaseConnected = await this.isDatabaseConnected();

    return {
      status: databaseConnected ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      timestamp: new Date().toISOString(),
      database_connected: databaseConnected,
      version: this.configService.get<string>('APP_VERSION', '0.1.0'),
    };
  }

  private async isDatabaseConnected(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        return false;
      }
      // Cheap round-trip to confirm the connection is actually alive,
      // not just that the pool was initialized at startup.
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error as Error);
      return false;
    }
  }
}
