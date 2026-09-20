import { Entity, Column, OneToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '@common/entities/base.entity';
import { Role } from '@common/enums/role.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

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


  @Column({ nullable: true })
  assignedState!: string;


  @Column({ type: 'smallint', nullable: true })
  scoringSlot!: number | null;
}