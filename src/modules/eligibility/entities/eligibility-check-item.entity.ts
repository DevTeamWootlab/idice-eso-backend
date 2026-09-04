import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { EligibilityChecklist } from './eligibility-checklist.entity';

export enum EligibilityCheckCode {
  LEGAL_REGISTRATION = 'LEGAL_REGISTRATION',
  TAX_COMPLIANCE = 'TAX_COMPLIANCE',
  GEOGRAPHIC_PRESENCE = 'GEOGRAPHIC_PRESENCE',
  RELEVANT_EXPERIENCE = 'RELEVANT_EXPERIENCE',
  KEY_PERSONNEL_CVS = 'KEY_PERSONNEL_CVS',
  VERIFIABLE_REFERENCES = 'VERIFIABLE_REFERENCES',
  FINANCIAL_STATEMENTS = 'FINANCIAL_STATEMENTS',
  INSTITUTIONAL_ENDORSEMENT = 'INSTITUTIONAL_ENDORSEMENT',
  TECHNICAL_CONCEPT_NOTE = 'TECHNICAL_CONCEPT_NOTE',
  WORKPLAN_BUDGET = 'WORKPLAN_BUDGET',
  CONFLICT_OF_INTEREST_DECLARATION = 'CONFLICT_OF_INTEREST_DECLARATION',
  BROWNFIELD_NDPA_DECLARATIONS = 'BROWNFIELD_NDPA_DECLARATIONS',
}

@Entity('eligibility_check_items')
export class EligibilityCheckItem extends BaseEntity {
  @ManyToOne(() => EligibilityChecklist, (c) => c.items, {
    onDelete: 'CASCADE',
  })
  checklist!: EligibilityChecklist;

  @Column()
  checklistId!: string;

  @Column({ type: 'enum', enum: EligibilityCheckCode })
  code!: EligibilityCheckCode;

  @Column({ default: false })
  passed!: boolean;

  @Column({ type: 'text', nullable: true })
  note!: string;

  @Column({ type: 'timestamptz', nullable: true })
  checkedAt!: Date; // per-item timestamp for the audit trail (TC-ELI-02)
}
