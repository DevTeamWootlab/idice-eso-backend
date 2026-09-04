import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@common/filters/exceptions/http-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.transformer';
import { LoggingInterceptor } from '@common/interceptors/logger.interceptor';
import { initSwagger } from '@/docs/swagger';
import logger from '@config/logger/winston-logger';
import { NestExpressApplication } from '@nestjs/platform-express';
// ...



async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });

  const configService = app.get(ConfigService);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins'),
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      enableDebugMessages:
        configService.get<string>('app.env') !== 'production',
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['health'] });

  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new LoggingInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  initSwagger(app);
  app.enableShutdownHooks();

  const port = configService.get<number>('app.port', 3000);
  const host = configService.get<string>('app.host', '0.0.0.0');
  await app.listen(port, host);

  logger.log(`Application running on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  logger.error('Application failed to bootstrap', err);
  process.exit(1);
});
