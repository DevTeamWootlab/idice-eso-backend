import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmploymentOutcome } from './entities/employment-outcome.entity';
import { OutcomesService } from './outcomes.service';
import { OutcomesController } from './outcomes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmploymentOutcome])],
  controllers: [OutcomesController],
  providers: [OutcomesService],
  exports: [OutcomesService],
})
export class OutcomesModule {}
