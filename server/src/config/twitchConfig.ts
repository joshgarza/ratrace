// src/config/twitchConfig.ts
import dotenv from 'dotenv';
dotenv.config(); // Ensure .env is loaded

export const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
export const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
export const YOUR_BROADCASTER_ID = process.env.YOUR_TWITCH_USER_ID;
export const CHANNEL_POINT_REWARD_ID_FOR_BETS = process.env.TWITCH_CHANNEL_POINT_REWARD_ID;

// Define scopes with a fallback that includes all needed permissions
export const TWITCH_SCOPES_STRING = 'channel:read:subscriptions channel:read:redemptions user:read:email channel:moderate user:read:chat channel:bot';
export const TWITCH_SCOPES_ARRAY = TWITCH_SCOPES_STRING.split(' ');

// Log the scopes we're using for debugging
console.log('Using Twitch scopes:', TWITCH_SCOPES_ARRAY);

export function validateTwitchConfig(): boolean {
  if (!TWITCH_CLIENT_ID) {
    console.error('Missing environment variable: TWITCH_CLIENT_ID');
    return false;
  }
  if (!TWITCH_CLIENT_SECRET) {
    console.error('Missing environment variable: TWITCH_CLIENT_SECRET');
    return false;
  }
  if (!YOUR_BROADCASTER_ID) {
    console.error('Missing environment variable: YOUR_BROADCASTER_ID');
    return false;
  }
  // CHANNEL_POINT_REWARD_ID_FOR_BETS is optional for core functionality
  // if (!CHANNEL_POINT_REWARD_ID_FOR_BETS) {
  //     console.warn("Missing environment variable: TWITCH_CHANNEL_POINT_REWARD_ID_FOR_BETS (needed for betting feature)");
  // }
  return true;
}
