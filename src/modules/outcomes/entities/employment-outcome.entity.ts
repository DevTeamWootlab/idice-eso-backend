import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Beneficiary } from '@modules/beneficiaries/entities/beneficiary.entity';
import { EmploymentOutcomeType } from '@/common/enums/outcomes.enum';

@Entity('employment_outcomes')
export class EmploymentOutcome extends BaseEntity {
  @OneToOne(() => Beneficiary)
  @JoinColumn()
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column({ type: 'enum', enum: EmploymentOutcomeType })
  outcomeType!: EmploymentOutcomeType;

  @Column({ nullable: true })
  employerOrVentureName!: string;

  @Column({ type: 'date', nullable: true })
  achievedOn!: Date;

  @Column({ type: 'int', nullable: true })
  monthsSinceCompletion!: number;

  @Column({ nullable: true })
  verifiedBy!: string;

  @Column({ default: false })
  verified!: boolean;
}
