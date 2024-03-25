import {forwardRef, Module} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletBotService } from './wallet-bot.service';
import { WalletBotUpdate } from './wallet-bot.update';
import { User } from '../entities/user.entity';
import { ClientGroup } from '../entities/client-group.entity';
import {HttpModule} from '@nestjs/axios';
import {EthereumModule} from '../ethereum/ethereum.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([User, ClientGroup]),
    HttpModule,
    forwardRef(() => EthereumModule)
  ],
  providers: [WalletBotService, WalletBotUpdate],
  exports: [WalletBotService],
})
export class WalletBotModule {}
