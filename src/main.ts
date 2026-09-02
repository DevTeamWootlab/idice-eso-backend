import { NestApplication, NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { HttpExceptionFilter } from "./modules/core/exceptions/http-exception.filter";
import { ResponseInterceptor } from "./config/response.transformer";
import { initSwagger } from "./docs/swagger";
import logger from "./config/logger/winston-logger";
import { LoggingInterceptor } from "./config/logger/logger.interceptor";

let app: NestApplication;
async function application() {
  app = await NestFactory.create(AppModule, { cors: true, logger: logger });
  app.enableCors();
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      enableDebugMessages: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix("api");
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new LoggingInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  initSwagger(app);
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? "0.0.0.0");
}
application();

export { app };
