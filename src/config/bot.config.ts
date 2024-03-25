import { registerAs } from '@nestjs/config';

export default registerAs('bot', () => ({
  token: process.env.BOT_TOKEN,
  apiKeyMainnet: process.env.API_KEY_MAINNET,
  apiKeyEtherscan: process.env.API_KEY_ETHERSCAN,
  notificationChatId: process.env.NOTIFICATION_CHAT_ID,
  chainBaseApiKey: process.env.CHAIN_BASE_API_KEY,
}));
