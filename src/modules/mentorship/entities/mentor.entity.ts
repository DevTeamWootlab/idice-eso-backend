import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('mentors')
export class Mentor extends BaseEntity {
  @Column()
  fullName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  phoneNumber!: string;

  @Column({ nullable: true })
  expertiseArea!: string;

  @Column({ nullable: true })
  organisation!: string;

  @Column({ default: true })
  isActive!: boolean;
}
