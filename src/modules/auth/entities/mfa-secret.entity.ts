import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';

@Entity('mfa_secrets')
export class MfaSecret {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User)
  @JoinColumn()
  user!: User;

  @Column()
  userId!: string;

  @Column()
  encryptedSecret!: string; // TOTP secret, encrypted at rest

  @Column('simple-array', { nullable: true })
  backupCodes!: string[]; // hashed, single-use
}
