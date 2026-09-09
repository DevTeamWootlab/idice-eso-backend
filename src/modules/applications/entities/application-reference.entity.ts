import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Application } from './application.entity';



@Entity('application_references')
export class ApplicationReference extends BaseEntity {
  @ManyToOne(() => Application, (a) => a.references, { onDelete: 'CASCADE' })
  application!: Application;

  @Column()
  applicationId!: string;

  @Column()
  fullName!: string;

  @Column()
  relationship!: string; // e.g. "Client, Partner", "Former Professor", "Owner"

  @Column({ nullable: true })
  organisationName!: string;

  @Column()
  phoneNumber!: string;

  @Column()
  email!: string;

  @Column({ default: false })
  verified!: boolean;
}