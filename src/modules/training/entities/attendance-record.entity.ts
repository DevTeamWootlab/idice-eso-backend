import { Entity, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { TrainingSession } from './training-session.entity';
import { Beneficiary } from '@modules/beneficiaries/entities/beneficiary.entity';
import { AttendanceStatus } from '@/common/enums/training.enum';

@Entity('attendance_records')
@Index(['sessionId', 'beneficiaryId'], { unique: true })
export class AttendanceRecord extends BaseEntity {
  @ManyToOne(() => TrainingSession)
  @JoinColumn({ name: 'sessionId' })
  session!: TrainingSession;

  @Column()
  sessionId!: string;

  @ManyToOne(() => Beneficiary)
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status!: AttendanceStatus;

  @Column({ nullable: true })
  markedBy!: string;
}
