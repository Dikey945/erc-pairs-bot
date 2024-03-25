import { EthereumService } from './ethereum.service';
import {forwardRef, Module} from '@nestjs/common';

import {TypeOrmModule} from '@nestjs/typeorm';
import {User} from '../entities/user.entity';
import {ClientGroup} from '../entities/client-group.entity';
import {Address} from '../entities/address.entity';
import {WalletBotModule} from '../wallet-bot/wallet-bot.module';
import {HttpModule} from '@nestjs/axios';
import {Token} from '../entities/token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ClientGroup, Address, Token]),
    forwardRef(() => WalletBotModule),
    HttpModule,
  ],
  providers: [EthereumService],
  exports: [EthereumService],
})
export class EthereumModule {}