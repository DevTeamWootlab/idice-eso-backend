import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institution } from './entities/institution.entity';
import { FacilitySafetyRequirement } from './entities/facility-safety-requirement.entity';
import { FacilityInspection } from './entities/facility-inspection.entity';
import { InstitutionUser } from './entities/institution-user.entity';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Institution,
      FacilitySafetyRequirement,
      FacilityInspection,
      InstitutionUser,
    ]),
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
