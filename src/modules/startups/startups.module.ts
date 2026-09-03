import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StartupMilestone } from './entities/startup-milestone.entity';
import { StartupsService } from './startups.service';
import { StartupsController } from './startups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StartupMilestone])],
  controllers: [StartupsController],
  providers: [StartupsService],
  exports: [StartupsService],
})
export class StartupsModule {}
