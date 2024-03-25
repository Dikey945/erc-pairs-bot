import {forwardRef, Inject, Injectable} from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { Repository } from "typeorm";
import { Context, Telegraf } from 'telegraf';

import {ClientGroup} from '../entities/client-group.entity';
import {ConfigService} from '@nestjs/config';
import {InjectBot} from 'nestjs-telegraf';
import * as cheerio from 'cheerio';
import {HttpService} from '@nestjs/axios';
import * as puppeteer from 'puppeteer';
import {linkButtons} from './wallet-bot-buttons';
import {EthereumService} from '../ethereum/ethereum.service';
import {getPathsToTry} from 'tsconfig-paths/lib/try-path';
import {formDailyReportData, formTopGainersMessage} from '../ethereum/utils/utilities';


@Injectable()
export class WalletBotService {
  private readonly BOT_TOKEN: string = this.configService.get<string>('bot.token');
  private readonly chatId: string = this.configService.get<string>('bot.notificationChatId');

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(ClientGroup)
    private clientGroupRepository: Repository<ClientGroup>,

    private configService: ConfigService,

    @InjectBot()
    private readonly bot: Telegraf<Context>,

    private httpService: HttpService,

    @Inject(forwardRef(() => EthereumService))
    private ethereumService: EthereumService,
  ) {}

  async notifyAboutNewPair(
    message: string,
    photoUrl?: string,
    photoBuffer?: Buffer,
    tokenAddress?: string,
    pairAddress?: string,
  ): Promise<number | undefined> {
    try {
      const photoContent = photoBuffer ? { source: photoBuffer } : photoUrl;
      let sentMessage;

      // Check if a photo needs to be sent
      if (photoContent) {
        // Attempt to send the photo and optional caption
        sentMessage = await this.bot.telegram.sendPhoto(
          this.chatId,
          photoContent,
          {
            parse_mode: 'Markdown',
            caption: message.length > 1024 ? undefined : message,
            reply_markup: linkButtons(tokenAddress, pairAddress).reply_markup
          }
        );
        if(message.length > 1024) {
          sentMessage = await this.bot.telegram.sendMessage(
            this.chatId,
            message,
            {
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
              reply_markup: linkButtons(tokenAddress, pairAddress).reply_markup
            }
          );
        }
      } else {
        // If there's no photo URL, just send the message
        sentMessage = await this.bot.telegram.sendMessage(
          this.chatId,
          message,
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: linkButtons(tokenAddress, pairAddress).reply_markup
          }
        );
      }

      return sentMessage.message_id;
    } catch (e) {
      console.error("An error occurred while sending the notification:", e);
      return undefined;
    }
  }

  async fetchPreviewImageFromHtml(url: string): Promise<string | null> {
    try {
      console.log('Fetching HTML from:', url)
      const response = await this.httpService.axiosRef.get(url);
      const $ = cheerio.load(response.data);
      console.log('Fetched HTML:', $.html());
      let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
      if (!ogImage) {
        ogImage = $('img').first().attr('src');

        // Resolve the image URL relative to the page URL if necessary
        if (ogImage && !ogImage.startsWith('http')) {
          const urlObject = new URL(ogImage, url);
          ogImage = urlObject.href;
        }
      }
      console.log('ogImage', ogImage);
      return ogImage || null; // May return null if not found
    } catch (error) {
      console.error(`Error fetching or parsing HTML from ${url}:`, error);
      return null;
    }
  }

  async captureScreenshot(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const screenshot = await page.screenshot({ fullPage: true });
    await browser.close();
    return screenshot;
  }

  async sendPhotoFromBuffer(photoBuffer, captionText) {
    try {
      await this.bot.telegram.sendPhoto(
        this.chatId,
        { source: photoBuffer },
        { caption: captionText }
      );
    } catch (error) {
      console.error('Failed to send photo:', error);
    }
  };

  async getImageBufferFromTgChannel(tgUrl: string) {
    const tgTag = tgUrl.split('/').pop();
    try {
      const channel = await this.httpService.axiosRef.get(`https://api.telegram.org/bot${this.BOT_TOKEN}/getChat?chat_id=@${tgTag}`);
      const fileId = channel.data.result.photo.big_file_id;
      const file = await this.bot.telegram.getFile(fileId);
      const filePath = file.file_path;
      const url = `https://api.telegram.org/file/bot${this.BOT_TOKEN}/${filePath}`;
      const downLoadedFile = await this.httpService.axiosRef.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(downLoadedFile.data)

    } catch (error) {
      console.error('Error getting image from Telegram channel:');
    }
  }

  async getTopGainersMessage(chatId: number) {
    try{
      const topGainers = await this.ethereumService.getTopGainers();
      console.log('Top gainers:', topGainers)
      if (!topGainers || topGainers.length < 3) {
        console.log('No top gainers found')
        this.bot.telegram.sendMessage(
          chatId,
          'Ohhhh shhhittt, currently we have only bullshit tokens. 😂😂😂',
        );
        return;
      }
      console.log('Top gainers:', topGainers)
      const message = formTopGainersMessage(topGainers);
      this.bot.telegram.sendMessage(
        chatId,
        message,
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }
      );
    } catch (error) {
      console.error('Error getting top gainers:', error);
    }
  }

  async sendMessageToChannel(message: string, chatId: string=this.chatId) {
    try {
      await this.bot.telegram.sendMessage(
        chatId,
        message,
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }
      );
    } catch (error) {
      console.error('Error sending message to channel:', error);
    }
  }

  async sendDailyReportToChannelByCommand(chatId: string) {
    try {
      const {topGainers, rugPulls, successfulTokens, totalTokens} = await this.ethereumService.getDailyReportData();
      const message = formDailyReportData(topGainers, totalTokens, rugPulls, successfulTokens);
      this.sendMessageToChannel(message, chatId);
    } catch (error) {
      console.error('Error sending daily report to channel:', error);
    }
  }
}
