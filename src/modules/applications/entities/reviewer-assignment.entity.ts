import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Application } from './application.entity';
import { User } from '@modules/users/entities/user.entity';
import { ReviewerQueueType } from '@/common/enums/reviewer.enum';

@Entity('reviewer_assignments')
@Index(['applicationId', 'reviewerId', 'queueType'], { unique: true })
export class ReviewerAssignment extends BaseEntity {
  @ManyToOne(() => Application)
  application!: Application;

  @Column()
  applicationId!: string;

  @ManyToOne(() => User)
  reviewer!: User;

  @Column()
  reviewerId!: string;

  @Column({ type: 'enum', enum: ReviewerQueueType })
  queueType!: ReviewerQueueType;

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt!: Date;

  @Column({ default: false })
  completed!: boolean;
}
