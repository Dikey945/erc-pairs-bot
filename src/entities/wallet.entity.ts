import {Column, Entity} from 'typeorm';
import {EntityHelper} from '../utils/entity-helper';

@Entity()
export class Wallet extends EntityHelper {
  @Column()
  privateKey: string;

  @Column()
  publicKey: string;

  @Column()
  addressHex: string;

  @Column()
  addressBase58: string;
}