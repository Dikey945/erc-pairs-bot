import { Context as BaseContext } from 'telegraf';

export interface BotTransaction {
  description?: string;
  amount?: number;
  category?: string;
}
export interface Context extends BaseContext {
  session: {
    stage: string | null;
    transaction: BotTransaction;
  };
}

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

type ChatMemberStatus = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';

export interface ChatMember {
  user: User;
  status: ChatMemberStatus;
}
