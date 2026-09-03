import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Institution } from './institution.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity('institution_users')
@Index(['institutionId', 'userId'], { unique: true })
export class InstitutionUser extends BaseEntity {
  @ManyToOne(() => Institution)
  institution!: Institution;

  @Column()
  institutionId!: string;

  @ManyToOne(() => User)
  user!: User;

  @Column()
  userId!: string;

  @Column({ nullable: true })
  roleTitle!: string; // "CoE Focal Person" etc — descriptive, not the RBAC role

  @Column({ default: true })
  isActive!: boolean;
}
