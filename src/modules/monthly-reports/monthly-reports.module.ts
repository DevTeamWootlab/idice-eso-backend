import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { MonthlyReport } from './entities/monthly-report.entity';
import { MonthlyReportsService } from './monthly-reports.service';
import { MonthlyReportsController } from './monthly-reports.controller';
import { InternalMonthlyReportsController } from './internal-monthly-reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MonthlyReport]), StorageModule],
  controllers: [MonthlyReportsController, InternalMonthlyReportsController],
  providers: [MonthlyReportsService],
})
export class MonthlyReportsModule {}
