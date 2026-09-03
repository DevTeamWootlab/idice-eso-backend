// modules/eligibility/entities/eligibility-checklist.entity.ts
import { Entity, Column, ManyToOne, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { User } from '@modules/users/entities/user.entity';
import { EligibilityCheckItem } from './eligibility-check-item.entity';

@Entity('eligibility_checklists')
export class EligibilityChecklist extends BaseEntity {
  @OneToOne(() => Application)
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @ManyToOne(() => User)
  reviewer!: User;

  @Column()
  reviewerId!: string;

  @OneToMany(() => EligibilityCheckItem, (item) => item.checklist, {
    cascade: true,
  })
  items!: EligibilityCheckItem[]; // exactly 12 rows

  @Column({ nullable: true })
  overallResult!: 'PASS' | 'FAIL';

  @Column({ type: 'text', nullable: true })
  rejectionRemarks!: string; // mandatory when overallResult = FAIL (TC-ELI-04)

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date;
}
