import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { Institution } from '@modules/institutions/entities/institution.entity';

export enum MatchStatus {
  GENERATED = 'GENERATED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('matches')
export class Match extends BaseEntity {
  @OneToOne(() => Application)
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @OneToOne(() => Institution)
  @JoinColumn({ name: 'institutionId' })
  institution!: Institution;

  @Column()
  institutionId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  matchCompatibilityIndex!: number;

  // The three named MCI components (see computeMci in matching-rules.ts) — persisted
  // alongside the final index so the admin UI can show the breakdown that actually
  // produced this match, not a value recomputed later against possibly-changed data.
  @Column({ type: 'jsonb', nullable: true })
  breakdown!: {
    hubAlignmentScore: number;
    capacityAlignment: number;
    institutionalRelationshipScore: number;
  } | null;

  @Column()
  state!: string;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.GENERATED })
  status!: MatchStatus;

  @Column({ type: 'timestamptz', nullable: true })
  matchedAt!: Date;
}
