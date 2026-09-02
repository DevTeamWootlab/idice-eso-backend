import { NestApplication } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function initSwagger(app: NestApplication) {
  const config = new DocumentBuilder()
    .setTitle("API")
    .setDescription("API Docs")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);
}
