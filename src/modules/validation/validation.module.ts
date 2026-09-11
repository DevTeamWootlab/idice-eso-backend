import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { UsersModule } from '../users/users.module';
import { ValidationRecord } from './entities/validation-record.entity';
import { Application } from '../applications/entities/application.entity';
import { ValidationService } from './validation.service';
import { ValidationController } from './validation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ValidationRecord, Application]),
    ApplicationsModule,
    UsersModule,
  ],
  controllers: [ValidationController],
  providers: [ValidationService],
})
export class ValidationModule {}
