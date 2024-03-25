import {MessageData, TokenGainersData} from './types';

export const formMessage = (messageData: MessageData): string =>  {
  const {
    name,
    symbol,
    newTokenAddress,
    urls,
    buyTax,
    sellTax,
    owner,
    totalSupply,
    dexScreenerData,
    deployerAddress,
    tokenHoldersCount
  } = messageData;

  const isBuySellTax = buyTax !== undefined
    && buyTax !== null
    && sellTax !== undefined
    && sellTax !== null;

  let message = '';
  if (name && symbol) {
  message += `*${name}* | $${symbol}\n\n`;
}

message += '`'+`${newTokenAddress}` + '`' + '\n';

if (newTokenAddress || deployerAddress) {
  message += `└🐳 [Holders](https://etherscan.io/token/${newTokenAddress}#balances)\n`;

  message += '└📝 [Contract](https://etherscan.io/token/' +
    `${newTokenAddress}#code)\n`;

  if (deployerAddress) {
    message += `└🧑‍💻 [Deployer](https://etherscan.io/address/${deployerAddress})\n\n`;
  }
}

if (urls && Object.keys(urls).length > 0) {
  message += '🗂 Socials:\n'
  if (urls.tg) {
    message += `└🗣 [Telegram](${urls.tg}) ${urls.twitter || urls.website ? '\n' : '\n\n'}`;
  }
  if (urls.twitter) {
    message += `└✖️ [Twitter](${urls.twitter}) ${urls.website ? '\n': '\n\n'}`;
  }
  if (urls.website) {
    message += `└🖥 [Website](${urls.website}) \n\n`;
  }
}
if (
  isBuySellTax
) {
  message += `🏦 Tax: ${buyTax}/${sellTax}%${dexScreenerData ? '\n' : '\n\n'}`;
}
if (dexScreenerData) {
  const volume = dexScreenerData.volume.h24;
  const isHotContract = volume >= 5000
  const priceChange = dexScreenerData.priceChange.h24;
  message += `📊 Volume: ${volume}$${isHotContract ? ' 🔥*HOT*' : ''} \n` +
    `💹 Price Change: ${priceChange}% \n\n`;
}
message += `👥 Holders: ${tokenHoldersCount ? tokenHoldersCount : 0}\n`;
if (dexScreenerData) {
  const m5Txns = dexScreenerData.txns.h24;
  message += `📈 Buys: ${m5Txns.buys} \n` +
    `📉 Sells: ${m5Txns.sells} \n\n`;
}
return message.trim();
}

export const formTopGainersMessage = (topGainers: TokenGainersData[]): string => {
  if (!topGainers || topGainers.length < 3) {
    return 'No top gainers for the last hour';
  }
  let message = '👑 *TOP 3 GAINERS FOR THE LAST HOUR*\n\n';
  message += `🥇 [$${topGainers[0].tokenSymbol.trim()}](https://t.me/dumbtokens/${topGainers[0].messageId}) ${topGainers[0].gain}%\n`;
  message += `🥈 [$${topGainers[1].tokenSymbol.trim()}](https://t.me/dumbtokens/${topGainers[1].messageId}) ${topGainers[1].gain}%\n`;
  message += `🥉 [$${topGainers[2].tokenSymbol.trim()}](https://t.me/dumbtokens/${topGainers[2].messageId}) ${topGainers[2].gain}%\n`;
  return message;
}

export const formDailyReportData = (
  topGainers: TokenGainersData[],
  totalTokens: number,
  rugPulls: number,
  successfulTokens: number,
): string => {
  const formattedDate = new Date().toLocaleDateString('en-GB');
  let message = `🗓 @dumbtokens daily stats for ${formattedDate} \n\n ❗️*PAST 24 HOURS:*\n\n`;
  message += `🔵 LAUNCHED: ${totalTokens}\n🟢 SUCCESSFULLY: ${successfulTokens}\n🔴 RUG PULLS: ${rugPulls}\n\n`;
  message += formTopGainersMessage(topGainers);
  return message;
}