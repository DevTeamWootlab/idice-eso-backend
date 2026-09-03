import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { SubAward } from './sub-award.entity';
import { SubAwardTrancheStatus } from '@/common/enums/finance.enum';

@Entity('sub_award_tranches')
export class SubAwardTranche extends BaseEntity {
  @ManyToOne(() => SubAward, (a) => a.tranches)
  subAward!: SubAward;

  @Column()
  subAwardId!: string;

  @Column({ type: 'int' })
  trancheNumber!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amountNgn!: number;

  @Column({ type: 'date', nullable: true })
  disbursedAt!: Date;

  @Column({
    type: 'enum',
    enum: SubAwardTrancheStatus,
    default: SubAwardTrancheStatus.PENDING,
  })
  status!: SubAwardTrancheStatus;
}
