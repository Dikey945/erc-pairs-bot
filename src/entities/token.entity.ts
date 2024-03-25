import {Column, Entity, Index} from 'typeorm';
import {EntityHelper} from '../utils/entity-helper';

@Entity()
export class Token extends EntityHelper {
  @Column({unique: true})
  @Index()
  tokenAddress?: string;

  @Column()
  pairAddress?: string;

  @Column()
  @Index()
  deployerAddress?: string;

  @Column({nullable: true})
  initialTokenPriceNative?: string;

  @Column({nullable: true})
  currentTokenPriceNative?: string;

  @Column()
  tokenName?: string;

  @Column()
  tokenSymbol?: string;

  @Column({nullable: true, type : 'float'})
  tokenInitialLiquidity?: number;

  @Column({nullable: true})
  telegramLink?: string;

  @Column({nullable: true})
  website?: string;

  @Column({nullable: true})
  twitter?: string;

  @Column({default: false})
  isDexScreenAvailable?: boolean;

  @Column({nullable: true})
  byuTax?: number;

  @Column({nullable: true})
  sellTax?: number;

  @Column({ default: false })
  isRugPull?: boolean;

  @Column({ nullable: true })
  messageId?: number;
}