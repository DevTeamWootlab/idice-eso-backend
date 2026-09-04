import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('login_attempts')
@Index(['email'])
export class LoginAttempt extends BaseEntity {
  @Column()
  email!: string;

  @Column({ default: false })
  successful!: boolean;

  @Column({ nullable: true })
  ipAddress!: string;
}