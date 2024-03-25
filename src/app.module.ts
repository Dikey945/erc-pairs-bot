import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import * as LocalSession from 'telegraf-session-local';
import { ConfigModule, ConfigService } from '@nestjs/config';
import botConfig from './config/bot.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { WalletBotModule } from './wallet-bot/wallet-bot.module';
import {EthereumModule} from './ethereum/ethereum.module';
import databaseConfig from './config/database.config';
import {ScheduleModule} from '@nestjs/schedule';

const sessions = new LocalSession({ database: 'sessions.json' });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.development'],
      load: [botConfig, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options) => {
        return new DataSource(options).initialize();
      },
    }),
    TelegrafModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        console.log(configService.get<string>('bot.token'));
        return {
          middlewares: [sessions.middleware()],
          token: configService.get<string>('bot.token'),
        };
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    EthereumModule,
    WalletBotModule,
  ],
})
export class AppModule {}
