import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { SubAwardTranche } from './sub-award-tranche.entity';

@Entity('sub_awards')
export class SubAward extends BaseEntity {
  @OneToOne(() => Application)
  @JoinColumn()
  application!: Application;

  @Column()
  applicationId!: string;

  @Column({ unique: true })
  awardReference!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  totalAmountNgn!: number;

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date', nullable: true })
  endDate!: Date;

  @Column({ nullable: true })
  dedicatedBankAccountRef!: string;

  @OneToMany(() => SubAwardTranche, (t) => t.subAward)
  tranches!: SubAwardTranche[];
}
