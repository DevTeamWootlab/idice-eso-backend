import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('rubric_configurations')
@Unique(['dimensionCode'])
export class RubricConfiguration extends BaseEntity {
  @Column()
  dimensionCode!: string;

  @Column()
  label!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  weightPercentage!: number;

  @Column({ default: true })
  isActive!: boolean;
}
