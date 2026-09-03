import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Mentor } from './mentor.entity';
import { Beneficiary } from '@modules/beneficiaries/entities/beneficiary.entity';
import { MentorshipStatus } from '@common/enums/mentorship.enum';

@Entity('mentor_assignments')
@Index(['mentorId', 'beneficiaryId'], { unique: true })
export class MentorAssignment extends BaseEntity {
  @ManyToOne(() => Mentor)
  mentor!: Mentor;

  @Column()
  mentorId!: string;

  @ManyToOne(() => Beneficiary)
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column({
    type: 'enum',
    enum: MentorshipStatus,
    default: MentorshipStatus.ACTIVE,
  })
  status!: MentorshipStatus;

  @Column({ type: 'date', nullable: true })
  matchedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string;
}
