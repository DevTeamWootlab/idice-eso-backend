import { Entity, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Institution } from '@modules/institutions/entities/institution.entity';
import { Course } from './course.entity';
import { CohortStatus } from '@common/enums/training.enum';

@Entity('cohorts')
@Index(['institutionId', 'status'])
export class Cohort extends BaseEntity {
  @Column()
  name!: string;

  @ManyToOne(() => Institution)
  @JoinColumn({ name: 'institutionId' })
  institution!: Institution;

  @Column()
  institutionId!: string;

  @ManyToOne(() => Course, { nullable: true })
  @JoinColumn({ name: 'courseId' })
  course!: Course;

  @Column({ nullable: true })
  courseId!: string;

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date', nullable: true })
  endDate!: Date;

  @Column({ type: 'enum', enum: CohortStatus, default: CohortStatus.PLANNED })
  status!: CohortStatus;

  @Column({ type: 'int', default: 0 })
  capacity!: number;
}
