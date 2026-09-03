import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from './application.entity';

@Entity('application_references')
export class ApplicationReference extends BaseEntity {
  @ManyToOne(() => Application, (a) => a.references, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application!: Application;

  @Column()
  applicationId!: string;

  @Column()
  organisationName!: string;

  @Column()
  contactName!: string;

  @Column()
  officialEmail!: string;

  @Column()
  phoneNumber!: string;

  @Column({ default: false })
  verified!: boolean; // per TC-APP-02 completeness check
}
