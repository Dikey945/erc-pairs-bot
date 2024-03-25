import {forwardRef, Inject, Injectable, Logger, OnModuleInit} from '@nestjs/common';
import { ethers } from 'ethers';
import { WalletBotService } from '../wallet-bot/wallet-bot.service';
import { uniswapAbi, unverifiedTokenFakeABI } from './utils/uniswap.abi';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {CreateTokenRequest, MessageData, Pair, TokenGainersData, URLS} from './utils/types';
import { Interface, InterfaceAbi } from 'ethers/lib.esm/abi';
import * as cheerio from 'cheerio';
import * as puppeteer from 'puppeteer';
import { Cron } from '@nestjs/schedule';
import {Token} from '../entities/token.entity';
import {Between, LessThanOrEqual, MoreThanOrEqual, Repository} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {formDailyReportData, formMessage, formTopGainersMessage} from './utils/utilities';

@Injectable()
export class EthereumService implements OnModuleInit {
  private readonly API_KEY = this.configService.get<string>('bot.apiKeyMainnet');
  private readonly API_KEY_ETHERSCAN = this.configService.get<string>('bot.apiKeyEtherscan');
  private readonly CHAIN_BASE_API_KEY = this.configService.get<string>('bot.chainBaseApiKey');
  private readonly provider: ethers.WebSocketProvider;
  private uniswapFactoryContract: ethers.Contract;
  private factoryABI = uniswapAbi;
  private uniswapFactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  private readonly WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  private fakeTokenAbi = unverifiedTokenFakeABI;
  // private wsProviderUrl = `wss://eth-mainnet.alchemyapi.io/v2/${this.API_KEY}`;
  private wsProviderUrl = `wss://mainnet.infura.io/ws/v3/${this.API_KEY}`;
  private readonly logger = new Logger(EthereumService.name);
  private boundPairCreatedListener: any;

  constructor(
    @Inject(forwardRef(() => WalletBotService))
    private walletBotService: WalletBotService,
    private configService: ConfigService,
    private httpService: HttpService,
    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,

  ) {
    this.provider = new ethers.WebSocketProvider(this.wsProviderUrl);
    this.uniswapFactoryContract = new ethers.Contract(this.uniswapFactoryAddress, this.factoryABI, this.provider);
    this.listenForPairCreated();
  }

  async onModuleInit() {

  }
  @Cron('0 1-23 * * *') // This cron expression means "at minute 0 of every hour"
  async scheduleTopGainersPost() {
    try{
      this.logger.log('Posting top gainers...');
      const topGainers = await this.getTopGainers();
      if (topGainers.length > 2) {
        const message = formTopGainersMessage(topGainers);
        await this.walletBotService.sendMessageToChannel(message);
      }
    } catch (error) {
      console.error('Error posting top gainers:', error);
    }
  }

  @Cron('*/3 * * * *') // This cron expression means "every 3 minutes"
  async scheduleCheckAndFillInitialTokenPrice() {
    try{
      this.logger.log('Checking and filling initial token price...');
      await this.checkAndFillInitialTokenPrice();
    } catch (error) {
      console.error('Error checking and filling initial token price:', error);
    }
  }

  @Cron('*/30 * * * *') // This cron expression means "every 30 minutes"
  async scheduleCheckRugPulls() {
    try{
      this.logger.log('Checking for rug pulls...');
      await this.checkRugPulls();
    } catch (error) {
      console.error('Error checking for rug pulls:', error);
    }
  }

  @Cron('59 23 * * *')
  async scheduleDailyReport() {
    try{
      this.logger.log('Sending daily report...');
      const {topGainers, rugPulls, successfulTokens, totalTokens} = await this.getDailyReportData();
      const message = formDailyReportData(topGainers, totalTokens, rugPulls, successfulTokens);
      await this.walletBotService.sendMessageToChannel(message);
    } catch (error) {
      console.error('Error sending daily report:', error);
    }
  }

  private async retryWithExponentialBackoff<T>(operation: () => Promise<T>, maxRetries: number = 5, initialDelay: number = 1000): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.log(`Operation failed after ${maxRetries} retries.`);
        }
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Operation failed after maximum retries.');
  }

  private async listenForPairCreated() {
    this.logger.log("Listening for PairCreated events");

    this.uniswapFactoryContract.on('PairCreated', async (token0, token1, pair, event) => {
      console.log(`Pair Created: ${pair}`);
      console.log(`Token0: ${token0}`);
      console.log(`Token1: ${token1}`);
      const newTokenAddress = token0 === this.WETH ? token1 : token0;
      try {
        const ethPrice = await this.getETHPrice();
        const initialLiquidity = await this.fetchInitialLiquidity(pair);
        let isContractVerified = true;
        let newTokenContractABI: string | Interface | InterfaceAbi = await this.fetchContractABI(newTokenAddress);
        console.log('Initial Liquidity:', initialLiquidity);

        if (!newTokenContractABI) {
          console.log('Token ABI not found. Most probably token contract unverified. Using fake ABI');
          isContractVerified = false;
          newTokenContractABI = this.fakeTokenAbi;
        }

        const newTokenContract = new ethers.Contract(newTokenAddress, newTokenContractABI, this.provider);
        const name = await newTokenContract.name();
        const symbol = await newTokenContract.symbol();
        const decimals = await newTokenContract.decimals();
        const supplyBigInt = await newTokenContract.totalSupply()
        const supply = Number(ethers.formatUnits(supplyBigInt, decimals));
        const wethAmountBigInt = await this.getBalanceOfToken(this.WETH, pair);
        const wethAmount = Number(ethers.formatUnits(wethAmountBigInt, 18));
        const newTokenAmountBigInt = await this.getBalanceOfToken(newTokenAddress, pair);
        const newTokenAmount = Number(ethers.formatUnits(newTokenAmountBigInt, decimals));
        let initialTokenPrice = 0;
        if (wethAmount > 0) {
          initialTokenPrice = wethAmount / newTokenAmount;
        }
        console.log(`Initial Token Price: ${initialTokenPrice}`);

        let urls: URLS | null = null;
        let buyTax = null;
        let sellTax = null;
        let owner = null;

        const sourceCode = isContractVerified ? await this.fetchContractSourceCode(newTokenAddress) : null;
        if (sourceCode) {
          urls = this.extractAndSaveUrls(sourceCode);
          const buySellTax = this.extractTaxRates(sourceCode);
          buyTax = buySellTax.buyTax;
          sellTax = buySellTax.sellTax;
          owner = await this.getContractOwner(newTokenContract);
        }
        console.log(`WETH Amount: ${wethAmount}`);
        console.log(`New Token Amount: ${newTokenAmount}`);
        console.log(`Total Supply: ${supply}`);
        console.log(`Token Name: ${name}`);
        console.log(`Token Symbol: ${symbol}`);
        console.log(`Decimals: ${decimals}`);

        await this.delay(60000 ) // wait for 1 minute before processing the event

        const dexScreenerData = await this.getDexScreenerData(newTokenAddress);
        const tokenHolders = await this.getTokenHolders(newTokenAddress);
        const deployerAddress = await this.findDeployerAddress(newTokenAddress);
        console.log('Deployer Address:', deployerAddress);
        console.log('DexScreener Data:');
        console.log("Token holders:", tokenHolders.count);

        const newMessageData = {
          newTokenAddress,
          name,
          symbol,
          decimals,
          urls,
          buyTax,
          sellTax,
          owner,
          totalSupply: supply,
          wethAmount,
          dexScreenerData,
          deployerAddress,
          tokenHoldersCount: tokenHolders?.count
        };

        const message = formMessage(newMessageData);
        let photoBuffer = null;
        let imageUrl = null;
        if(urls && urls.tg) {
          photoBuffer = await this.walletBotService
            .getImageBufferFromTgChannel(urls.tg);
        }
        if (urls && urls.website && !photoBuffer) {
          imageUrl = await this.fetchPreviewImageFromHtml(urls.website);
        }
        console.log("Urls for preview Image:", urls);
        const messageId = await this.walletBotService.notifyAboutNewPair(
          message,
          imageUrl,
          photoBuffer,
          newTokenAddress,
          pair
        );

        const newToken = {
          tokenAddress: newTokenAddress,
          pairAddress: pair,
          deployerAddress,
          initialTokenPriceNative: dexScreenerData ? dexScreenerData.priceNative : null,
          currentTokenPriceNative: dexScreenerData ? dexScreenerData.priceNative : null,
          tokenName: name,
          tokenSymbol: symbol,
          tokenInitialLiquidity: wethAmount,
          isDexScreenAvailable: !!dexScreenerData,
          byuTax: buyTax,
          sellTax: sellTax,
          isRugPull: false,
          messageId
        }
        await this.createToken(newToken);
      } catch (error) {
        console.error('Error retrieving token details:', error);
      }
    });
  }

  private async delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  private getLiquidityAmounts(wethPrice: number, wethAmount: number) {
    return wethPrice * wethAmount * 2;
  }

  async fetchContractABI(contractAddress: string): Promise<string | null> {
    const etherscanApiKey = this.configService.get<string>('bot.apiKeyEtherscan');

    // Define the operation to fetch the ABI as a function that can be retried
    const fetchABI = async () => {
      const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=${etherscanApiKey}`;
      const response = await this.httpService.axiosRef.get(url);
      if (response.data.status === '1' && response.data.message === 'OK') {
        return JSON.parse(response.data.result);
      } else {
        throw new Error(`ABI retrieval unsuccessful: status ${response.data.status}, message: ${response.data.message}`);
      }
    };

    // Use the retryWithExponentialBackoff method to attempt fetching the ABI with retries
    try {
      return await this.retryWithExponentialBackoff(fetchABI, 5, 1000);
    } catch (error) {
      console.error('Error fetching contract ABI with retries:', error);
      return null;
    }
  }


  async fetchContractSourceCode(contractAddress: string): Promise<string> {
    const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${this.API_KEY_ETHERSCAN}`;

    try {
      const response$ = this.httpService.get(url);
      const response = await lastValueFrom(response$);
      const data = response.data;

      if (data.status === '1' && data.message === 'OK' && data.result.length > 0) {
        // Assuming the contract has its source code verified, it will be part of the returned data
        // console.log('Contract Source Code:', data.result[0].SourceCode);
        return data.result[0].SourceCode;
      } else {
        throw new Error('Failed to retrieve contract source code or contract source code not verified');
      }
    } catch (error) {
      console.error('Error fetching contract source code:', error);
      throw error; // Rethrowing the error or handling it as needed
    }
  }

  async findDeployerAddress(contractAddress: string) {
    console.log('Fetching deployment block for contract:', contractAddress)
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${contractAddress}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=${this.API_KEY_ETHERSCAN}`;

    try {
      const response = await this.httpService.axiosRef.get(url);
      const transactions = response.data.result;
      console.log('Transactions:', transactions);

      if (transactions && transactions.length > 0) {
        // Assuming the first transaction is the contract creation transaction
        const deploymentTransaction = transactions[0];
        console.log(`Contract was deployed by: ${deploymentTransaction.from}`);
        return deploymentTransaction.from;
      } else {
        console.log('No deployment transaction found for this contract address.');
        return null;
      }
    } catch (error) {
      console.error('Error fetching deployment block:', error);
      return null;
    }
  }

  private extractAndSaveUrls(sourceCode: string): URLS {
    const urlRegex = /https?:\/\/\S+/g;
    const urls = sourceCode.match(urlRegex);
    const result = {
      tg: '',
      twitter: '',
      website: ''
    };
    urls && urls.length > 0 && urls.forEach(url => {
      const cleanUrl = url.replace(/\\[rn].*$/, '');

      if (cleanUrl.includes('twitter.com') && !result.twitter) {
        result.twitter = cleanUrl;
      } else if (cleanUrl.includes('t.me') && !result.tg) {
        result.tg = cleanUrl;
      } else if (
        !cleanUrl.includes('github')
        && !cleanUrl.includes('zeppelin')
        && !result.website
        && !cleanUrl.includes('eips')
        && !cleanUrl.includes('github')
      ) {
        result.website = cleanUrl;
      }
    });

    console.log('Extracted URLs:', result);
    Object.keys(result).forEach(key => {
      if (result[key] === '') {
        delete result[key];
      }
    });
    return result;
  }

  extractTaxRates(sourceCode: string): { buyTax: number; sellTax: number } {
    const buyTaxPattern = /uint256 private _initialBuyTax=(\d+);/;
    const sellTaxPattern = /uint256 private _initialSellTax=(\d+);/;

    const buyTaxMatch = sourceCode.match(buyTaxPattern);
    const sellTaxMatch = sourceCode.match(sellTaxPattern);

    // Convert matches to numbers, return 0 or another default value if not found
    const buyTax = buyTaxMatch ? Number(buyTaxMatch[1]) : 0;
    const sellTax = sellTaxMatch ? Number(sellTaxMatch[1]) : 0;

    return { buyTax, sellTax };
  }

  async getDexScreenerData(tokenAddress: string): Promise<Pair> {
    try {
      const url = `https://api.dexscreener.com/latest/dex/search/?q=${tokenAddress}`;
      const result = await this.httpService.axiosRef.get(url);
      return result?.data?.pairs[0];
    } catch (error) {
      console.error('Error fetching DexScreener data:', error);
      return null
    }
  }

  private async fetchInitialLiquidity(pairAddress: string) {
    try {
      const UniswapV2PairABI = await this.fetchContractABI('0x5497981d274EF0cFcb4a25dE77c8cc694E5a595C')
      const pairContract = new ethers.Contract(pairAddress, UniswapV2PairABI, this.provider);
      const reserves = await pairContract.getReserves();
      console.log(`Initial Reserves - Reserve0: ${reserves[0].toString()}, Reserve1: ${reserves[1].toString()}`);
    } catch (error) {
      console.error('Error fetching initial liquidity:', error);
    }

    // Reserve0 and Reserve1 are the initial liquidity amounts for token0 and token1 respectively
  }

  getContractOwner(contract: ethers.Contract) {
    try {
      return contract.owner();
    } catch (error) {
      return null
    }
  }

  async getETHPrice() {
    try{
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`;
      const result =  await this.httpService.axiosRef.get(url);
      return result.data.ethereum.usd
    } catch (error) {
      console.error('Error fetching ETH price:', error);
    }
  }

  async getBalanceOfToken(tokenAddress: string, pairAddress: string): Promise<string> {
    const url = `https://api.etherscan.io/api`;
    const params = {
      module: 'account',
      action: 'tokenbalance',
      contractaddress: tokenAddress,
      address: pairAddress,
      tag: 'latest',
      apikey: this.API_KEY_ETHERSCAN,
    };

    try {
      const response = await this.httpService.get(url, { params }).toPromise();
      const balance = response.data.result;
      return balance;
    } catch (error) {
      console.error('Error retrieving token balance:', error);
      throw error;
    }
  }

  private formatNumberWithSpaces(num) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(num);
  }

  private createAddressShortcut(address: string) {
    return address.slice(0, 8) + '...' + address.slice(-8);
  }

  async fetchPreviewImageFromHtml(url: string): Promise<string | null> {
    try {
      console.log('Fetching HTML from:', url)
      const response = await this.httpService.axiosRef.get(url);
      const $ = cheerio.load(response.data);
      let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
      if (!ogImage) {
        ogImage = $('img').first().attr('src');

        // Resolve the image URL relative to the page URL if necessary
        if (ogImage && !ogImage.startsWith('http')) {
          const urlObject = new URL(ogImage, url);
          ogImage = urlObject.href;
        }
      }
      return ogImage || null; // May return null if not found
    } catch (error) {
      console.error(`Error fetching or parsing HTML from ${url}:`);
      return null;
    }
  }

  async getPreviewImage(links: URLS): Promise<string | null> {
    const types = ['website', 'tg', 'twitter'];
    try {
      for (let type of types) {
        if (links[type]) {
          const imageUrl = await this.fetchPreviewImageFromHtml(links[type]);
          console.log(`Preview image found for ${type}:`, imageUrl);
          if (imageUrl) {
            console.log(`Preview image found for ${type}:`, imageUrl);
            return imageUrl;
          }
        }
      }
      return null; // No image found
    } catch (error) {
      console.error('Error fetching preview image:');
      return null;
    }
  }

  async getTokenHolders(contractAddress: string): Promise<any> {
    const chainId = 1;
    const url = `https://api.chainbase.online/v1/token/holders`;

    try {
      const response = await this.httpService.axiosRef.get(url, {
        headers: {
          'x-api-key': this.CHAIN_BASE_API_KEY
        },
        params: {
          chain_id: chainId,
          contract_address: contractAddress
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching token holders')
      throw new Error('Failed to fetch token holders');
    }
  }

  async captureScreenshot(url) {
    try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(url);
      const screenshot = await page.screenshot({ fullPage: true });
      await browser.close();
      return screenshot;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      return null;
    }

  }

  private async createToken(token: CreateTokenRequest): Promise<Token> {
    try {
      return await this.tokenRepository.save(token);
    } catch (error) {
      console.error('Error creating token:', error);}
  }

  private async processTokens(fetchCondition: any, processResponse: (token: any, response: any) => void) {
    let url = 'https://api.dexscreener.com/latest/dex/pairs/ethereum/';
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const now = new Date(); // Current time

    try {
      const tokens = await this.tokenRepository.find({
        where: {
          ...fetchCondition,
          createdAt: Between(today, now)
        }
      });

      const pairsList = tokens.map(token => token.pairAddress);
      url += pairsList.join(',');
      const tokensCurrentData = await this.httpService.axiosRef.get(url);

      for(let token of tokens) {
        const matchingPair = tokensCurrentData.data?.pairs.find(pair => pair.pairAddress === token.pairAddress);
        if(matchingPair) {
          processResponse(token, matchingPair);
        }
      }

      await this.tokenRepository.save(tokens);
    } catch (error) {
      console.error('Error processing tokens:', error);
    }
  }

  async getTopGainers() {
    const BATCH_SIZE = 30; // Define your batch size based on the API limit
    const urlBase = 'https://api.dexscreener.com/latest/dex/pairs/ethereum/';
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const now = new Date(); // Current time

    try {
      const tokensWithDexScreenerData = await this.tokenRepository.find({
        where: {
          isDexScreenAvailable: true,
          isRugPull: false,
          createdAt: Between(today, now)
        }
      });

      // Calculate the number of batches
      const batches = Math.ceil(tokensWithDexScreenerData.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        console.log('Processing batch:', i + 1, 'of', batches)
        // Get the tokens for the current batch
        const batchTokens = tokensWithDexScreenerData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        // Create the URL for the current batch
        const batchPairsList = batchTokens.map(token => token.pairAddress);
        const url = urlBase + batchPairsList.join(',');

        // Make the API request for the current batch
        const tokensCurrentData = await this.httpService.axiosRef.get(url);

        for (let token of batchTokens) {
          const matchingPair = tokensCurrentData.data?.pairs.find(pair => pair.pairAddress === token.pairAddress);
          if (matchingPair) {
            token.currentTokenPriceNative = matchingPair.priceNative;
          }
        }
      }

      const topGainers: TokenGainersData[] = tokensWithDexScreenerData.map(token => {
        const initialPrice = parseFloat(token.initialTokenPriceNative);
        const currentPrice = parseFloat(token.currentTokenPriceNative);
        const gain = ((currentPrice - initialPrice) / initialPrice) * 100;
        return {
          id: token.id,
          tokenAddress: token.tokenAddress,
          tokenSymbol: token.tokenSymbol,
          messageId: token.messageId,
          gain: gain.toFixed(2) // rounding to 2 decimal places
        };
      }).sort((a, b) => parseFloat(b.gain) - parseFloat(a.gain));
      await this.tokenRepository.save(tokensWithDexScreenerData);
      return topGainers.slice(0, 3);

    } catch (error) {
      console.error('Error fetching top gainers:', error);
    }
  }

  async checkAndFillInitialTokenPrice() {
    const BATCH_SIZE = 30; // Define your batch size based on the API limit
    const urlBase = 'https://api.dexscreener.com/latest/dex/pairs/ethereum/';
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const now = new Date(); // Current time

    try {
      const tokens = await this.tokenRepository.find({
        where: {
          isDexScreenAvailable: false,
          createdAt: Between(today, now)
        }
      });
      console.log('Tokens without initial price:', tokens.length);

      // Calculate the number of batches
      const batches = Math.ceil(tokens.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        // Get the tokens for the current batch
        const batchTokens = tokens.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        // Create the URL for the current batch
        const batchPairsList = batchTokens.map(token => token.pairAddress);
        const url = urlBase + batchPairsList.join(',');

        // Make the API request for the current batch
        const tokensCurrentData = await this.httpService.axiosRef.get(url);
        if (!tokensCurrentData.data?.pairs) {
          console.log('No pairs found in the response');
          return;
        }

        for (let token of batchTokens) {
          const matchingPair = tokensCurrentData.data?.pairs.find(pair => pair.pairAddress === token.pairAddress && pair.priceNative);
          if (matchingPair) {
            token.initialTokenPriceNative = matchingPair.priceNative;
            token.currentTokenPriceNative = matchingPair.priceNative;
            token.isDexScreenAvailable = true;
          }
        }
      }

      await this.tokenRepository.save(tokens);

    } catch (error) {
      console.error('Error checking for initial price', error);
    }
  }

  async checkRugPulls() {
    const BATCH_SIZE = 30; // Define your batch size based on the API limit
    const urlBase = 'https://api.dexscreener.com/latest/dex/pairs/ethereum/';
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const now = new Date(); // Current time

    try {
      const tokens = await this.tokenRepository.find({
        where: {
          isRugPull: false,
          isDexScreenAvailable: true,
          createdAt: Between(today, now)
        }
      });

      // Calculate the number of batches
      const batches = Math.ceil(tokens.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        // Get the tokens for the current batch
        const batchTokens = tokens.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        // Create the URL for the current batch
        const batchPairsList = batchTokens.map(token => token.pairAddress);
        const url = urlBase + batchPairsList.join(',');

        // Make the API request for the current batch
        const tokensCurrentData = await this.httpService.axiosRef.get(url);

        for (let token of batchTokens) {
          const matchingPair = tokensCurrentData.data?.pairs.find(pair => pair.pairAddress === token.pairAddress);
          if (matchingPair && matchingPair?.liquidity?.usd < 500) {
            token.isRugPull = true;
          }
        }
      }

      await this.tokenRepository.save(tokens);
    } catch (error) {
      console.error('Error checking for rug pulls', error);
    }
  }

  async getDailyReportData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const now = new Date(); // Current time
    try {
      await this.checkAndFillInitialTokenPrice();
      await this.checkRugPulls();
      const tokens = await this.tokenRepository.find({
        where: {
          createdAt: Between(today, now)
        }
      });
      const totalTokens = tokens.length;
      const rugPulls = tokens.filter(token => token.isRugPull).length;
      const successfulTokens = totalTokens - rugPulls;
      const topGainers = await this.getTopGainers();
      return {
        totalTokens,
        rugPulls,
        successfulTokens,
        topGainers
      }
    } catch (error) {
      console.error('Error fetching daily report data:', error);
    }
  }
}