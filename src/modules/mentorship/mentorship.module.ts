// modules/mentorship/mentorship.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mentor } from './entities/mentor.entity';
import { MentorAssignment } from './entities/mentor-assignment.entity';
import { MentorshipService } from './mentorship.service';
import { MentorshipController } from './mentorship.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mentor, MentorAssignment])],
  controllers: [MentorshipController],
  providers: [MentorshipService],
  exports: [MentorshipService],
})
export class MentorshipModule {}
