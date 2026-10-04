import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Infrastructure health check',
    description:
      'Returns server status and database connectivity. Used by uptime ' +
      'monitors and deployment tests.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  async check(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }

  /**
   * Readiness is deliberately separate from the general status endpoint.
   * Azure App Service uses this endpoint for health checks and slot warm-up,
   * so a lost PostgreSQL connection must be a non-2xx response.
   */
  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Database-aware deployment readiness check' })
  @ApiOkResponse({ type: HealthResponseDto })
  async ready(): Promise<HealthResponseDto> {
    const health = await this.healthService.check();
    if (!health.database_connected) {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
