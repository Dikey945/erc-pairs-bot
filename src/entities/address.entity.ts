import {EntityHelper} from '../utils/entity-helper';
import {Column, Entity, Index} from 'typeorm';

@Entity('address')
export class Address extends EntityHelper {
  @Column({unique: true})
  @Index()
  address?: string;

  @Column()
  description?: string;
}