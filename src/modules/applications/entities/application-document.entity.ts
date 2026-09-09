import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from './application.entity';

export const DOCUMENT_TYPES = {
  REGISTRATION_CERTIFICATE: 'REGISTRATION_CERTIFICATE',
  TAX_CLEARANCE: 'TAX_CLEARANCE',
  ORGANOGRAM: 'ORGANOGRAM',
  CV: 'CV',
  AUDITED_ACCOUNTS: 'AUDITED_ACCOUNTS',
  BANK_REFERENCE_LETTER: 'BANK_REFERENCE_LETTER',
  CONCEPT_NOTE: 'CONCEPT_NOTE',
  WORKPLAN: 'WORKPLAN',
  BUDGET: 'BUDGET',
  CONFLICT_OF_INTEREST_EVIDENCE: 'CONFLICT_OF_INTEREST_EVIDENCE',
  INSTITUTION_ENDORSEMENT_LETTER: 'INSTITUTION_ENDORSEMENT_LETTER',
  OPERATIONAL_PRESENCE_EVIDENCE: 'OPERATIONAL_PRESENCE_EVIDENCE',
  EVIDENCE_OF_DELIVERY: 'EVIDENCE_OF_DELIVERY',
  INCUBATION_ACCELERATION_EVIDENCE: 'INCUBATION_ACCELERATION_EVIDENCE',
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];
@Entity('application_documents')
export class ApplicationDocument extends BaseEntity {
  @ManyToOne(() => Application, (a) => a.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @Column({
    type: 'varchar',
    enum: Object.values(DOCUMENT_TYPES),
    name: 'document_type',
  })
  documentType!: DocumentType;

  @Column()
  storageKey!: string; // S3/Blob object key

  @Column()
  originalFileName!: string;

  @Column()
  mimeType!: string;

  @Column({ type: 'int' })
  fileSizeBytes!: number; // enforce 10MB cap in service layer before persisting
};
