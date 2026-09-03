import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('facility_safety_requirements')
@Unique(['code'])
export class FacilitySafetyRequirement extends BaseEntity {
  @Column()
  code!: string;

  @Column()
  label!: string;

  @Column({ default: true })
  isMandatory!: boolean;
}
