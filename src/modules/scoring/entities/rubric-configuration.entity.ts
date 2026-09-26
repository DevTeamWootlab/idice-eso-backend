import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { decimalTransformer } from '@/common/utils/decimal.transformer';

@Entity('rubric_configurations')
@Unique(['dimensionCode'])
export class RubricConfiguration extends BaseEntity {
  @Column()
  dimensionCode!: string;

  @Column()
  label!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  weightPercentage!: number;

  @Column({ default: true })
  isActive!: boolean;
}
