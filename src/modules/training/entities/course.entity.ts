import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { TrainingTier } from '@common/enums/beneficiary.enum';

@Entity('courses')
@Index(['tier'])
@Unique(['title', 'tier'])
export class Course extends BaseEntity {
  @Column()
  title!: string;

  @Column({ type: 'enum', enum: TrainingTier })
  tier!: TrainingTier;

  @Column({ nullable: true })
  hubType!: string;

  @Column({ type: 'int', nullable: true })
  durationWeeks!: number;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ default: true })
  isActive!: boolean;
}
