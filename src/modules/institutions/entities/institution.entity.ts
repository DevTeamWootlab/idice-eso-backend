import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum HubType {
  STANDARD = 'STANDARD',
  GAMING = 'GAMING',
  VR = 'VR',
  CREATIVE = 'CREATIVE',
}

@Entity('institutions')
@Index(['name'], { unique: true })
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  state!: string; // used for the E_loc = I_loc matching constraint

  @Column({ type: 'enum', enum: HubType, default: HubType.STANDARD })
  hubType!: HubType;

  @Column({ nullable: true })
  latitude!: number;

  @Column({ nullable: true })
  longitude!: number;

  @Column({ default: 0 })
  beneficiaryCapacity!: number;

  @Column({ default: true })
  isActive!: boolean;
}
