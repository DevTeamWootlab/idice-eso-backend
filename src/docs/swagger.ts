import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function initSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('iDICE ESO Portal API')
    .setDescription(
      [
        'Backend for the iDICE North Central ESO application portal and youth programme.',
        '',
        '**Response envelope.** Every successful response is wrapped as `{ "status": true, "timestamp": <ms>, "data": ... }`;',
        'the response schemas below describe the contents of `data`.',
        '',
        '**Roles.** Routes marked SYSADMIN require an administrator token; internal reviewer routes require the role named in each operation.',
        'Use `POST /auth/login` (and `/auth/mfa/verify` for internal roles) to obtain an access token, then Authorize.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Notifications', 'In-app notification inbox for the signed-in user')
    .addTag('Scoring settings', 'Scoring rubric weights (editable until scoring starts)')
    .addTag('PCU M&E (SYSADMIN)', 'Live programme KPI aggregation for the PCU dashboard')
    .addTag('Beneficiaries (SYSADMIN)', 'Review youth intake applications and allocate them to a Centre of Excellence')
    .addTag('Training (SYSADMIN)', 'Cohorts, enrolment and course completion')
    .addTag('Outcomes (SYSADMIN)', 'Graduate employment outcomes and their verification')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
