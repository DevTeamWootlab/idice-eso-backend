import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ClassSerializerInterceptor, ValidationPipe, VersioningType, Logger } from '@nestjs/common';
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
import { probeEmailedLinks, describeLinkProblems } from './common/utils/probe-emailed-links';
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
  
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  const corsVercelPreviewRegex = new RegExp(
    configService.get<string>(
      'app.corsVercelPreviewRegex',
      '^https://[a-z0-9-]+\\.vercel\\.app$',
    ),
  );

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Non-browser requests (curl, server-to-server, same-origin) have no Origin header.
      if (!requestOrigin) return callback(null, true);
      if (corsOrigins.includes(requestOrigin)) return callback(null, true);
      if (corsVercelPreviewRegex.test(requestOrigin))
        return callback(null, true);
      return callback(
        new Error(`Origin ${requestOrigin} is not allowed by CORS`),
        false,
      );
    },
    credentials: true,
    // Lets the portal read the real filename of a downloaded report (CSV / Excel / PDF).
    exposedHeaders: ['Content-Disposition'],
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

  app.setGlobalPrefix('api');

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
  const frontendUrl = configService.get<string>('app.frontendUrl') ?? '';
  // if (
  //   configService.get<string>('app.env') === 'production' &&
  //   (!/^https:\/\//.test(frontendUrl) || /localhost|127\.0\.0\.1/.test(frontendUrl))
  // ) {
  //   new Logger('Bootstrap').warn(
  //     `FRONTEND_URL is "${frontendUrl}" in production — verification and password-reset emails will link there. Set it to this environment's public portal URL (https).`,
  //   );
  // }
  if (
    configService.get<string>('app.env') === 'production' &&
    (!frontendUrl.startsWith('https://') ||
      /localhost|127\.0\.0\.1/.test(frontendUrl))
  ) {
    new Logger('Bootstrap').warn(
      `FRONTEND_URL is "${frontendUrl}" in production — verification and password-reset emails will link there. Set it to this environment's public portal URL (https).`,
    );
  }

  await app.listen(port, host);

  if (
    configService.get<string>('app.env') === 'production' &&
    frontendUrl.startsWith('https://') &&
    !/localhost|127\.0\.0\.1/.test(frontendUrl)
  ) {
    void probeEmailedLinks(frontendUrl).then((results) => {
      const problem = describeLinkProblems(frontendUrl, results);
      if (problem) new Logger('Bootstrap').error(problem);
    });
  }

  logger.log(`Application running on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  logger.error('Application failed to bootstrap', err);
  process.exit(1);
});
