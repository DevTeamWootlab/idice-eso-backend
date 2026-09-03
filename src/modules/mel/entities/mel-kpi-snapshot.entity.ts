import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';

@Entity('mel_kpi_snapshots')
@Index(['institutionId', 'snapshotDate'])
export class MELKpiSnapshot extends BaseEntity {
  @ManyToOne(() => Institution, { nullable: true })
  institution!: Institution; // null = programme-wide snapshot

  @Column({ nullable: true })
  institutionId!: string;

  @Column({ type: 'date' })
  snapshotDate!: Date;

  @Column({ type: 'int', default: 0 })
  youthTrained!: number;

  @Column({ type: 'int', default: 0 })
  femaleParticipants!: number;

  @Column({ type: 'int', default: 0 })
  pwdNeetParticipants!: number;

  @Column({ type: 'int', default: 0 })
  startupsSupported!: number;

  @Column({ type: 'int', default: 0 })
  mentorshipMatches!: number;

  @Column({ type: 'int', default: 0 })
  employmentOutcomes!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  completionRate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  certificationRate!: number;
}
