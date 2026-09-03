import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('validation_records')
export class ValidationRecord extends BaseEntity {
  @OneToOne(() => Application)
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @ManyToOne(() => User)
  validator!: User;

  @Column()
  validatorId!: string;

  @Column({ type: 'text', nullable: true })
  siteInspectionNotes!: string;

  @Column({ type: 'jsonb', nullable: true })
  geotaggedPhotos!: {
    storageKey: string;
    latitude: number;
    longitude: number;
    takenAt: string;
  }[];

  @Column({ default: false })
  physicalFootprintVerified!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  validatedAt!: Date;
}
