import { Entity, Column, ManyToOne, Unique, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { User } from '@modules/users/entities/user.entity';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { decimalTransformer } from '@/common/utils/decimal.transformer';

export enum ScoringReviewerSlot {
  REVIEWER_ONE = 'REVIEWER_ONE',
  REVIEWER_TWO = 'REVIEWER_TWO',
}

@Entity('score_cards')
@Unique(['applicationId', 'reviewerId'])
export class ScoreCard extends BaseEntity {
  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewerId' })
  reviewer!: User;

  @Column()
  reviewerId!: string;

  // @Column({ type: 'enum', enum: ScoringReviewerSlot })
  // reviewerSlot!: ScoringReviewerSlot;
  @Column({ type: 'int' })
  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  reviewerSlot!: number;

  @Column({ type: 'smallint' })
  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  localPresenceScore!: number;

  @Column({ type: 'smallint' })
  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  teamExpertiseScore!: number;

  @Column({ type: 'smallint' })
  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  incubationExperienceScore!: number;

  @Column({ type: 'smallint' })
  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  credibilityGovernanceScore!: number;

  @Column({ type: 'smallint' })
  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  deliveryTrackRecordScore!: number;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  @Column({ type: 'smallint', nullable: true })
  institutionalAlignmentScore?: number | null;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  compositeScore?: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  compositePercentage!: number;

  @Column({ type: 'boolean', default: false })
  submitted!: boolean;

  @Column({ type: 'text', nullable: true })
  comments!: string;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date;
}



