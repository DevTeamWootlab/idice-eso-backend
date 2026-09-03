import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Cohort } from './cohort.entity';

@Entity('training_sessions')
export class TrainingSession extends BaseEntity {
  @ManyToOne(() => Cohort)
  @JoinColumn({ name: 'cohortId' })
  cohort!: Cohort;

  @Column()
  cohortId!: string;

  @Column()
  title!: string;

  @Column({ type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ type: 'int', nullable: true })
  durationMinutes!: number;

  @Column({ nullable: true })
  facilitator!: string;
}
