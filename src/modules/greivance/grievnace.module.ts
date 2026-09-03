import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grievance } from './entities/grievance.entity';
import { GrievanceService } from './grievance.service';
import { GrievanceController } from './grievance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Grievance])],
  controllers: [GrievanceController],
  providers: [GrievanceService],
  exports: [GrievanceService],
})
export class GrievanceModule {}
