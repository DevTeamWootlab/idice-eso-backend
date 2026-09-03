import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Institution } from './institution.entity';

@Entity('facility_inspections')
export class FacilityInspection extends BaseEntity {
  @ManyToOne(() => Institution)
  @JoinColumn({ name: 'institutionId' })
  institution!: Institution;

  @Column()
  institutionId!: string;

  @Column()
  inspectedByUserId!: string;

  @Column({ type: 'date' })
  inspectionDate!: Date;

  @Column({ type: 'jsonb' })
  safetyChecklistResults!: {
    requirementCode: string;
    present: boolean;
    note?: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  ewmpAuditNotes!: Record<string, any>;

  @Column({ default: false })
  passed!: boolean;

  @Column({ type: 'text', nullable: true })
  remarks!: string;
}
