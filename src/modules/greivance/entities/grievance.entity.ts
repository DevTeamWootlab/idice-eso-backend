import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import {
  GrievanceCategory,
  GrievanceStatus,
} from '@/common/enums/grievance.enum';

@Entity('grievances')
@Index(['status'])
export class Grievance extends BaseEntity {
  @Column({ unique: true })
  referenceCode!: string;

  @Column({ type: 'enum', enum: GrievanceCategory })
  category!: GrievanceCategory;

  @Column({ default: true })
  isAnonymous!: boolean;

  @Column({ nullable: true })
  reporterContact!: string;

  @Column({ nullable: true })
  relatedApplicationId!: string;

  @Column({ nullable: true })
  relatedBeneficiaryId!: string;

  @Column({ nullable: true })
  relatedInstitutionId!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: GrievanceStatus,
    default: GrievanceStatus.OPEN,
  })
  status!: GrievanceStatus;

  @Column({ nullable: true })
  assignedToUserId!: string;

  @Column({ type: 'text', nullable: true })
  resolutionNotes!: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date;
}
