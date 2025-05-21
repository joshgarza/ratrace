// src/services/TwitchEventSub.ts
import WebSocket from 'ws';
import axios, { AxiosError } from 'axios';
import { TwitchAuthManager } from './TwitchAuthManager'; // Assuming TwitchAuthManager is in the same folder or adjust path
import { TWITCH_CLIENT_ID, YOUR_BROADCASTER_ID, CHANNEL_POINT_REWARD_ID_FOR_BETS } from '../config'; // Use centralized config
import {
  TwitchEventSubMessage,
  TwitchEventSubWelcomePayload,
  TwitchChannelPointsRedemptionPayload,
  TwitchChannelPointsRedemptionEvent,
  EventSubSubscriptionCondition,
} from '../types/twitch';
import { Bet } from '../types/app';
import { Server as SocketIOServer } from 'socket.io';

let twitchEventSubClient: WebSocket | null = null;
let twitchEventSubSessionId: string | null = null;

// This needs to be passed in or set globally
// For now, let's assume it's passed to the init function
let ioInstance: SocketIOServer | null = null;
let bettingOpenState: { isOpen: boolean } = { isOpen: false }; // To access bettingOpen
let currentBetsRef: { current: Bet[] } = { current: [] }; // To access currentBets

async function createEventSubSubscription(
  authManager: TwitchAuthManager,
  sessionId: string,
  type: string,
  version: string,
  condition: EventSubSubscriptionCondition
): Promise<void> {
  const accessToken = await authManager.getValidAccessToken();
  if (!accessToken) {
    console.error(`TwitchEventSub: Cannot create subscription for ${type}. No valid access token.`);
    return;
  }
  if (!sessionId) {
    console.error(`TwitchEventSub: Cannot create subscription for ${type}. Missing session ID.`);
    return;
  }

  console.log(`TwitchEventSub: Attempting to create subscription for type: ${type}`);
  try {
    await axios.post(
      'https://api.twitch.tv/helix/eventsub/subscriptions',
      { type, version, condition, transport: { method: 'websocket', session_id: sessionId } },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-ID': TWITCH_CLIENT_ID!,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`TwitchEventSub: Subscription created for ${type}.`);
  } catch (error) {
    console.error(`TwitchEventSub: Error creating subscription for ${type}:`);
    // ... (enhanced error logging from your original file)
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error('Status:', axiosError.response?.status);
      console.error('Data:', axiosError.response?.data);
    } else {
      console.error('Generic Error:', (error as Error).message);
    }
  }
}

export function connectToTwitchEventSub(
  authManager: TwitchAuthManager,
  io: SocketIOServer, // Pass Socket.IO server instance
  bettingState: { isOpen: boolean }, // Pass bettingOpen state object
  betsArray: { current: Bet[] } // Pass currentBets array object
): void {
  ioInstance = io; // Store for use in onmessage
  bettingOpenState = bettingState;
  currentBetsRef = betsArray;

  if (
    twitchEventSubClient &&
    (twitchEventSubClient.readyState === WebSocket.OPEN || twitchEventSubClient.readyState === WebSocket.CONNECTING)
  ) {
    console.log('TwitchEventSub: WebSocket client already open or connecting.');
    return;
  }

  console.log('TwitchEventSub: Connecting to Twitch EventSub WebSocket server...');
  twitchEventSubClient = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

  twitchEventSubClient.onopen = () => {
    console.log('TwitchEventSub: Successfully connected to Twitch EventSub WebSocket server.');
  };

  twitchEventSubClient.onmessage = (event: WebSocket.MessageEvent) => {
    const rawData = typeof event.data === 'string' ? event.data : event.data.toString();
    const message = JSON.parse(rawData) as TwitchEventSubMessage;

    switch (message.metadata.message_type) {
      case 'session_welcome':
        const welcomePayload = message.payload as TwitchEventSubWelcomePayload;
        twitchEventSubSessionId = welcomePayload.session.id;
        console.log(`TwitchEventSub: session_welcome. Session ID: ${twitchEventSubSessionId}`);
        // Subscribe to Channel Points Redemption
        if (CHANNEL_POINT_REWARD_ID_FOR_BETS && YOUR_BROADCASTER_ID && twitchEventSubSessionId) {
          createEventSubSubscription(
            authManager,
            twitchEventSubSessionId,
            'channel.channel_points_custom_reward_redemption.add',
            '1',
            { broadcaster_user_id: YOUR_BROADCASTER_ID, reward_id: CHANNEL_POINT_REWARD_ID_FOR_BETS }
          );
        } else {
          console.warn('TwitchEventSub: Not subscribing to betting reward. Missing reward_id or broadcaster_id.');
        }
        break;
      case 'notification':
        if (message.metadata.subscription_type === 'channel.channel_points_custom_reward_redemption.add') {
          const payload = message.payload as TwitchChannelPointsRedemptionPayload;
          const eventData = payload.event;
          console.log(
            `TwitchEventSub: Channel points redeemed by ${eventData.user_name}. Input: "${eventData.user_input}"`
          );
          if (CHANNEL_POINT_REWARD_ID_FOR_BETS && eventData.reward.id === CHANNEL_POINT_REWARD_ID_FOR_BETS) {
            if (bettingOpenState.isOpen) {
              const bet: Bet = {
                userId: eventData.user_id,
                userName: eventData.user_name,
                userLogin: eventData.user_login,
                rewardId: eventData.reward.id,
                userInput: eventData.user_input,
                timestamp: message.metadata.message_timestamp,
              };
              currentBetsRef.current.push(bet);
              console.log('TwitchEventSub: Bet recorded. Total bets:', currentBetsRef.current.length);
              if (ioInstance) {
                ioInstance.emit('new_bet_placed', { userName: eventData.user_name, betInput: eventData.user_input });
              }
            } else {
              console.log(`TwitchEventSub: Bet from ${eventData.user_name} but betting is closed.`);
            }
          }
        }
        break;
      // ... (handle other message types: keepalive, reconnect, revocation)
      case 'session_keepalive':
        break; // Usually no action needed
      case 'session_reconnect':
        const reconnectPayload = message.payload as TwitchEventSubWelcomePayload;
        console.log('TwitchEventSub: Received session_reconnect. New URL:', reconnectPayload.session.reconnect_url);
        if (twitchEventSubClient) twitchEventSubClient.close(1000, 'Reconnecting to new URL per Twitch');
        // Robust reconnect logic would connect to reconnectPayload.session.reconnect_url
        // For simplicity, the onclose handler's generic reconnect will fire.
        break;
      case 'revocation':
        console.log('TwitchEventSub: Subscription revoked:', JSON.stringify(message.payload, null, 2));
        break;
      default:
        console.log('TwitchEventSub: Received unhandled message type:', message.metadata.message_type);
    }
  };

  twitchEventSubClient.onerror = (error: WebSocket.ErrorEvent) => {
    console.error('TwitchEventSub: WebSocket error:', error.message);
  };

  twitchEventSubClient.onclose = (event: WebSocket.CloseEvent) => {
    console.log(`TwitchEventSub: WebSocket closed. Code: ${event.code}, Reason: "${event.reason}"`);
    twitchEventSubSessionId = null;
    twitchEventSubClient = null;
    if (event.code !== 1000) {
      console.log('TwitchEventSub: Attempting to reconnect in 5 seconds...');
      setTimeout(() => connectToTwitchEventSub(authManager, ioInstance!, bettingOpenState, currentBetsRef), 5000);
    }
  };
}

export function getTwitchEventSubClient(): WebSocket | null {
  return twitchEventSubClient;
}
