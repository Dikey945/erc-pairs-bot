interface TransactionDetails {
  sellToken: string | null;
  sellTokenAmount: string | null;
  buyToken: string | null;
  buyTokenAmount: string | null
  isBuyTransaction: boolean;
  tokenContract: string | null;
}

export interface URLS {
  twitter?: string;
  tg?: string;
  website?: string;
}

export interface MessageData {
  name?: string;
  symbol?: string;
  newTokenAddress?: string;
  urls?: URLS;
  buyTax?: number;
  sellTax?: number;
  owner?: string;
  marketCap?: number;
  initialLiquidity?: number;
  totalSupply?: number;
  wethAmount?: number;
  dexScreenerData?: Pair
  deployerAddress?: string;
  tokenHoldersCount?: number;
  deployerDeployedRugsQuantity?: number;
}

export interface Pair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: {
      buys: number;
      sells: number;
    };
    h1: {
      buys: number;
      sells: number;
    };
    h6: {
      buys: number;
      sells: number;
    };
    h24: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

export interface CreateTokenRequest {
  tokenAddress: string;
  pairAddress: string;
  deployerAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenInitialLiquidity?: number | null;
  telegramLink?: string | null;
  website?: string | null;
  twitter?: string | null;
  isDexScreenAvailable: boolean;
  byuTax?: number | null;
  sellTax?: number | null;
  isRugPull: boolean;
  messageId?: number | null;
}

export interface TokenGainersData {
  id: number;
  tokenAddress: string;
  tokenSymbol: string;
  messageId: number;
  gain: string;
}