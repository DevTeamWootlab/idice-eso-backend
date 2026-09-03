import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubAward } from './entities/sub-award.entity';
import { SubAwardTranche } from './entities/sub-award-tranche.entity';
import { FinancialRetirement } from './entities/financial-retirement.entity';
import { SubAwardsService } from './sub-awards.service';
import { SubAwardsController } from './sub-awards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubAward, SubAwardTranche, FinancialRetirement]),
  ],
  controllers: [SubAwardsController],
  providers: [SubAwardsService],
  exports: [SubAwardsService],
})
export class SubAwardsModule {}
