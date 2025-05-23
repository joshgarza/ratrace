// src/types/twitch.ts
export interface TwitchSubscription {
  user_id: string;
  user_name: string;
  user_login: string;
  tier: string;
  is_gift: boolean;
}

export interface TwitchSubscriptionsResponse {
  data: TwitchSubscription[];
  total: number;
  points: number;
}

export interface TwitchEventSubWelcomePayloadSession {
  id: string;
  status: string;
  connected_at: string;
  keepalive_timeout_seconds: number;
  reconnect_url: string | null;
}
export interface TwitchEventSubWelcomePayload {
  session: TwitchEventSubWelcomePayloadSession;
}

export interface TwitchEventSubMessageMetadata {
  message_id: string;
  message_type: string;
  message_timestamp: string;
  subscription_type?: string;
  subscription_version?: string;
}

export interface TwitchEventSubMessage {
  metadata: TwitchEventSubMessageMetadata;
  payload: any; // Consider using a generic or union type for more specific payloads
}

// Specific payload for channel points redemption notification
export interface TwitchChannelPointsRedemptionPayload {
  subscription: {
    id: string;
    status: string;
    type: string;
    version: string;
    cost: number;
    condition: {
      broadcaster_user_id: string;
      reward_id?: string; // Optional if subscribing to all redemptions
    };
    transport: {
      method: string;
      session_id: string;
    };
    created_at: string;
  };
  event: TwitchChannelPointsRedemptionEvent;
}

export interface TwitchChannelPointsRedemptionEvent {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  id: string; // Redemption ID
  user_id: string;
  user_login: string;
  user_name: string;
  user_input: string;
  status: 'unfulfilled' | 'fulfilled' | 'canceled'; // etc.
  redeemed_at: string;
  reward: {
    id: string;
    title: string;
    cost: number;
    prompt: string;
  };
}

export interface EventSubSubscriptionCondition {
  [key: string]: string;
}

// Chat message event interfaces
export interface TwitchChatMessagePayload {
  subscription: {
    id: string;
    status: string;
    type: string;
    version: string;
    condition: {
      broadcaster_user_id: string;
      user_id?: string; // Optional if subscribing to all chat messages
    };
    transport: {
      method: string;
      session_id: string;
    };
    created_at: string;
  };
  event: TwitchChatMessageEvent;
}

export interface TwitchChatMessageEvent {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message: {
    text: string;
    fragments: Array<{
      type: string;
      text: string;
      cheermote?: any;
      emote?: any;
      mention?: any;
    }>;
  };
  color?: string; // Chat color if set by user
  badges: Array<{
    set_id: string;
    id: string;
    info: string;
  }>;
  message_id: string;
  message_type: 'text' | 'action' | 'chat' | 'whisper';
  sent_at: string;
}
