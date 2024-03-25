import { WalletBotService } from './wallet-bot.service';
import {Action, Command, InjectBot, On, Start, Update} from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { Context } from '../types/types';
import {createWelcomeMessage} from './utils/welcome-message';
import {confirmFollowButtons, followButtons, subscribeButtons} from './wallet-bot-buttons';
import {ConfigService} from '@nestjs/config';

@Update()
export class WalletBotUpdate {
  private readonly BOT_TOKEN: string = this.configService.get<string>('bot.token');
  private readonly chatId: string = this.configService.get<string>('bot.notificationChatId');
  constructor(
    @InjectBot()
    private readonly bot: Telegraf<Context>,

    private readonly walletBotService: WalletBotService,
    private readonly configService: ConfigService,
  ) {}

  @Start()
  async startCommand(ctx: Context) {
    await ctx.reply('Не забудь про платну підписку');
  }

  @Command('gainers')
  async gainersCommand(ctx: Context) {
    console.log('ctx', ctx.chat);
    console.log('ctx.chat.chatId', ctx.chat.id);
    await this.walletBotService.getTopGainersMessage(ctx.chat.id);
  }

  @Command('dailyreport')
  async dailyReportCommand(ctx: Context) {
    const chatId = ctx.chat.id.toString();
    console.log('chatId', chatId);
    await this.walletBotService.sendDailyReportToChannelByCommand(chatId);
  }


  @On('message')
  async onMessage(ctx: Context) {
    await  this.walletBotService.getImageBufferFromTgChannel('https://t.me/BitcoinOnEth')
    console.log('Received a message: ', ctx.message);
    // if ('text' in ctx.message && typeof ctx.message.text === 'string') {
    //   const imageLink = await this.walletBotService.fetchPreviewImageFromHtml(ctx.message.text);
    //   console.log('imageLink', imageLink);
    //   const capture = await this.walletBotService.captureScreenshot(ctx.message.text);
    //   this.walletBotService.sendPhotoFromBuffer(capture, "Zaebis")
    //   console.log('capture', capture);
    // }
    // await this.walletBotService.consoleApiKeys();
    // You can also log specific parts of the message, like:
    // console.log('Message text: ', ctx.message.text);
  }


}
