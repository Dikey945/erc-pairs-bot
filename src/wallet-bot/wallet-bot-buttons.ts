import { Markup } from 'telegraf';

export const followButtons = (channels) => {
const buttons = channels.map((channel) => {
    return Markup.button.callback(channel.channelName, `join_${channel.channelId}`);
  });
  return Markup.inlineKeyboard(buttons, { columns: 1 });
}

export const  confirmFollowButtons = (channelId: number) => {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback('Готово', `confirm_${channelId}`),
    ],
    { columns: 2 },
  );
}

export const subscribeButtons = () => {
  return Markup.keyboard(
    [Markup.button.text('Підписатися')],
    { columns: 1 },
  );
}

export const linkButtons = (tokenAddress: string, pairAddress: string)  => {
  return Markup.inlineKeyboard(
    [
      [
        Markup.button.url('📈 DEXT', `https://www.dextools.io/app/en/ether/pair-explorer/${pairAddress}`),
        Markup.button.url('🔗 ETHSCAN', `https://etherscan.io/token/${tokenAddress}`),
        Markup.button.url('🦅 DEXS', `https://dexscreener.com/ethereum/${tokenAddress}`),
      ],
      [Markup.button.url('🍌 BANANA', 'https://t.me/BananaGunSniper_bot?start=ref_romanolegovich')],
      [Markup.button.url('Ⓜ️ MAESTRO', 'https://t.me/MaestroBots')],
      [Markup.button.url('🦄 UNISWAP', `https://app.uniswap.org/swap?outputCurrency=${tokenAddress}&chain=ethereum`)]


    ]
  );
}
