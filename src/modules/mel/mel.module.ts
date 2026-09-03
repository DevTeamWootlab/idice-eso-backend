import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MELKpiSnapshot } from './entities/mel-kpi-snapshot.entity';
import { MelService } from './mel.service';
import { MelController } from './mel.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MELKpiSnapshot])],
  controllers: [MelController],
  providers: [MelService],
  exports: [MelService],
})
export class MelModule {}
