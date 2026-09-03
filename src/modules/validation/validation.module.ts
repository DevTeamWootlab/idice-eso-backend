// modules/validation/validation.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { ValidationRecord } from './entities/validation-record.entity';
import { ValidationService } from './validation.service';
import { ValidationController } from './validation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationRecord]), ApplicationsModule],
  controllers: [ValidationController],
  providers: [ValidationService],
})
export class ValidationModule {}
