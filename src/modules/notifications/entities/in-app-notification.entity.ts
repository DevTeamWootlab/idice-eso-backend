import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('in_app_notifications')
@Index(['userId', 'readAt'])
export class InAppNotification extends BaseEntity {
  @Column()
  userId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', nullable: true })
  href!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}
