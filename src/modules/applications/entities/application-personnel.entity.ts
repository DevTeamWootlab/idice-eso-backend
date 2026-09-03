import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from './application.entity';

export enum PersonnelRole {
  EXECUTIVE_DIRECTOR = 'EXECUTIVE_DIRECTOR',
  TRAINING_LEAD = 'TRAINING_LEAD',
  INCUBATION_LEAD = 'INCUBATION_LEAD',
  MENTORSHIP_LEAD = 'MENTORSHIP_LEAD',
  OTHER = 'OTHER',
}

@Entity('application_personnel')
export class ApplicationPersonnel extends BaseEntity {
  @ManyToOne(() => Application, (a) => a.keyPersonnel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @Column()
  fullName!: string;

  @Column({ type: 'enum', enum: PersonnelRole })
  personnelRole!: PersonnelRole;

  @Column({ nullable: true })
  yearsOfExperience!: number;

  @Column({ nullable: true })
  cvDocumentId!: string; // FK to ApplicationDocument, kept loose to avoid circular import
}
