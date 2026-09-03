import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration from '@config/configuration';
import { validate } from '@config/validation.schema';
import { throttlerConfig } from '@common/throttler/throttler.config';

import { HealthModule } from '@modules/health/health.module';
import { UsersModule } from '@modules/users/users.module';
import { AuthModule } from '@modules/auth/auth.module';
import { InstitutionsModule } from '@modules/institutions/institutions.module';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { EligibilityModule } from '@modules/eligibility/eligibility.module';
import { ScoringModule } from '@modules/scoring/scoring.module';
import { ValidationModule } from '@modules/validation/validation.module';
import { MatchingModule } from '@modules/matching/matching.module';
import { BeneficiariesModule } from '@modules/beneficiaries/beneficiaries.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { AuditLogModule } from '@modules/audit-log/audit-log.module';
import { StorageModule } from '@modules/storage/storage.module';
import { SubAwardsModule } from './modules/sub-awards/sub-awards.module';
import { GrievanceModule } from './modules/greivance/grievnace.module';
import { MelModule } from './modules/mel/mel.module';
import { OutcomesModule } from './modules/outcomes/outcomes.module';
import { StartupsModule } from './modules/startups/startups.module';
import { TrainingModule } from './modules/training/training.module';
import { MentorshipModule } from './modules/mentorship/mentorship.module';
import { DatabaseModule } from '@config/db.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    DatabaseModule,

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: throttlerConfig,
    }),

    HealthModule,
    UsersModule,
    AuthModule,
    InstitutionsModule,
    ApplicationsModule,
    EligibilityModule,
    ScoringModule,
    ValidationModule,
    MatchingModule,
    BeneficiariesModule,
    NotificationsModule,
    AuditLogModule,
    StorageModule,
    TrainingModule,
    MentorshipModule,
    StartupsModule,
    OutcomesModule,
    MelModule,
    GrievanceModule,
    SubAwardsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // global rate limiting on every route by default
    },
  ],
})
export class AppModule {}
