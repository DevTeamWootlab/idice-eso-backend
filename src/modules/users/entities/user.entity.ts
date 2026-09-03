// modules/users/entities/user.entity.ts
import { Entity, Column, OneToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Role } from '@common/enums/role.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role })
  role!: Role;

  @Column({ nullable: true })
  fullName!: string;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ default: false })
  mfaEnabled!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  // Only populated for ROLE_VALIDATOR — enforces the state-restricted queue filter (TC-VAL-01)
  @Column({ nullable: true })
  assignedState!: string;
}
