// modules/users/entities/user.entity.ts
import { Entity, Column, OneToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '@common/entities/base.entity';
import { Role } from '@common/enums/role.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  // Never serialised on the wire — ClassSerializerInterceptor (registered globally in
  // main.ts) strips this from every response, including POST /internal/users (which
  // previously returned the raw entity) and any relation eagerly loaded elsewhere
  // (e.g. reviewer-assignments' `reviewer: true`).
  @Exclude()
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
