import { Entity, Column, ManyToOne, Unique, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { User } from '@modules/users/entities/user.entity';

export enum ScoringReviewerSlot {
  REVIEWER_ONE = 'REVIEWER_ONE',
  REVIEWER_TWO = 'REVIEWER_TWO',
}

@Entity('score_cards')
@Unique(['applicationId', 'reviewerId'])
export class ScoreCard extends BaseEntity {
  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewerId' })
  reviewer!: User;

  @Column()
  reviewerId!: string;

  @Column({ type: 'enum', enum: ScoringReviewerSlot })
  reviewerSlot!: ScoringReviewerSlot;

  @Column({ type: 'smallint' })
  localPresenceScore!: number;

  @Column({ type: 'smallint' })
  teamExpertiseScore!: number;

  @Column({ type: 'smallint' })
  incubationExperienceScore!: number;

  @Column({ type: 'smallint' })
  governanceComplianceScore!: number;

  @Column({ type: 'smallint' })
  deliveryTrackRecordScore!: number;

  @Column({ type: 'smallint' })
  institutionalAlignmentScore!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  compositeScore!: number;

  @Column({ type: 'text', nullable: true })
  comments!: string;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date;
}
