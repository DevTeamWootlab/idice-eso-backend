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

  @Column()
  state!: string;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.GENERATED })
  status!: MatchStatus;

  @Column({ type: 'timestamptz', nullable: true })
  matchedAt!: Date;
}
