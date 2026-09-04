import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity('refresh_tokens')
@Index(['sessionId'], { unique: true })
export class RefreshToken extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Column()
  userId!: string;

  @Column()
  sessionId!: string;

  @Column()
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  @Column({ nullable: true })
  userAgent!: string;

  @Column({ nullable: true })
  ipAddress!: string;
}
