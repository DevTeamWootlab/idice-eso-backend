import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { Cohort } from './entities/cohort.entity';
import { CohortMember } from './entities/cohort-member.entity';
import { TrainingSession } from './entities/training-session.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { TrainingCompletion } from './entities/training-completion.entity';
import { Certificate } from './entities/certificate.entity';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      Cohort,
      CohortMember,
      TrainingSession,
      AttendanceRecord,
      TrainingCompletion,
      Certificate,
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
