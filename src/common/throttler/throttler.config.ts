// common/config/throttler.config.ts
import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig = (
  configService: ConfigService,
): ThrottlerModuleOptions => [
  {
    ttl: configService.get<number>('throttle.ttl', 60) * 1000,
    limit: configService.get<number>('throttle.limit', 100),
  },
];
