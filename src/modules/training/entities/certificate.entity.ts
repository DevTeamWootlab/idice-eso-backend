import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { TrainingCompletion } from './training-completion.entity';

@Entity('certificates')
export class Certificate extends BaseEntity {
  @OneToOne(() => TrainingCompletion)
  @JoinColumn()
  trainingCompletion!: TrainingCompletion;

  @Column()
  trainingCompletionId!: string;

  @Column({ unique: true })
  certificateNumber!: string;

  @Column()
  storageKey!: string;

  @Column({ type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ default: false })
  revoked!: boolean;
}
