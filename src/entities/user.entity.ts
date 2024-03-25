import {Column, Entity, Index, JoinTable, ManyToMany} from 'typeorm';
import { EntityHelper } from '../utils/entity-helper';
import {ClientGroup} from './client-group.entity';

@Entity('user')
export class User extends EntityHelper {
  @Column({ unique: true })
  @Index()
  userTgId?: number;

  @Column()
  firstName?: string;

  @Column()
  userTag?: string;

  @Column()
  chatId?: number;

  @Column({nullable: true})
  isPremium?: boolean;

  @ManyToMany(() => ClientGroup)
  @JoinTable()
  clientGroups: ClientGroup[];
}
