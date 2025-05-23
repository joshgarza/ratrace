// src/services/TwitchEventSub.ts
import WebSocket from 'ws';
import axios, { AxiosError } from 'axios';
import { TwitchAuthManager } from './TwitchAuthManager'; // Assuming TwitchAuthManager is in the same folder or adjust path
import { TWITCH_CLIENT_ID, YOUR_BROADCASTER_ID } from '../config'; // Use centralized config
import {
  TwitchEventSubMessage,
  TwitchEventSubWelcomePayload,
  TwitchChatMessagePayload,
  TwitchChatMessageEvent,
  EventSubSubscriptionCondition,
} from '../types/twitch';
import { RaceParticipant } from '../types/app';
import { Server as SocketIOServer } from 'socket.io';
import { emitNewParticipant } from './SocketManager';

let twitchEventSubClient: WebSocket | null = null;
let twitchEventSubSessionId: string | null = null;

// References to shared state objects
let ioInstance: SocketIOServer | null = null;
let raceStateRef: { isOpen: boolean } = { isOpen: false };
let participantsRef: { current: RaceParticipant[] } = { current: [] };

// Command constants
const REGISTER_COMMAND = '!register';

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
    // First log token validation info for debugging
    try {
      const validationResponse = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      console.log(`TwitchEventSub: Token scopes: ${validationResponse.data.scopes?.join(', ')}`);
      console.log(`TwitchEventSub: Token user_id: ${validationResponse.data.user_id}`);
    } catch (validationError) {
      console.error('TwitchEventSub: Failed to validate token:', validationError);
    }

    // Now create the subscription
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
  raceState: { isOpen: boolean }, // Pass race state object
  participants: { current: RaceParticipant[] } // Pass participants array object
): void {
  ioInstance = io; // Store for use in onmessage
  raceStateRef = raceState;
  participantsRef = participants;

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

        // Subscribe to chat messages
        if (YOUR_BROADCASTER_ID && twitchEventSubSessionId) {
          // For chat.message, both broadcaster_user_id and user_id are required
          // Ideally, we want to listen to all chat messages in the channel
          // For now we'll just listen to the broadcaster's messages
          createEventSubSubscription(
            authManager,
            twitchEventSubSessionId,
            'channel.chat.message',
            '1',
            {
              broadcaster_user_id: YOUR_BROADCASTER_ID,
              user_id: YOUR_BROADCASTER_ID // For now, just listen to the broadcaster's messages
            }
          );

          console.log('TwitchEventSub: Attempted to subscribe to chat messages for broadcaster:', YOUR_BROADCASTER_ID);
        } else {
          console.warn('TwitchEventSub: Not subscribing to chat messages. Missing broadcaster_id.');
        }
        break;

      case 'notification':
        // Handle chat message for registration
        if (message.metadata.subscription_type === 'channel.chat.message') {
          const payload = message.payload as TwitchChatMessagePayload;
          const eventData = payload.event;

          // Check if this is a registration command
          if (eventData.message.text.trim().toLowerCase().startsWith(REGISTER_COMMAND.toLowerCase())) {
            handleRegistrationCommand(eventData);
          }
        }
        break;

      case 'session_keepalive':
        break; // No action needed

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
      setTimeout(() => connectToTwitchEventSub(authManager, ioInstance!, raceStateRef, participantsRef), 5000);
    }
  };
}

/**
 * Handles registration command from chat
 */
export function handleRegistrationCommand(chatEvent: TwitchChatMessageEvent): void {
  if (!raceStateRef.isOpen) {
    console.log(`TwitchEventSub: Registration attempt from ${chatEvent.chatter_user_name} but registration is closed.`);
    return;
  }

  // Check if user is already registered
  const alreadyRegistered = participantsRef.current.some(
    participant => participant.userId === chatEvent.chatter_user_id
  );

  if (alreadyRegistered) {
    console.log(`TwitchEventSub: ${chatEvent.chatter_user_name} already registered for the race.`);
    return;
  }

  // Register the user
  const participant: RaceParticipant = {
    userId: chatEvent.chatter_user_id,
    userName: chatEvent.chatter_user_name,
    userLogin: chatEvent.chatter_user_login,
    registeredAt: new Date().toISOString(),
    color: chatEvent.color || generateRandomColor(chatEvent.chatter_user_name) // Use chat color or generate one
  };

  participantsRef.current.push(participant);
  console.log(`TwitchEventSub: ${chatEvent.chatter_user_name} registered for the race. Total participants: ${participantsRef.current.length}`);

  // Notify clients via Socket.IO
  if (ioInstance) {
    emitNewParticipant(chatEvent.chatter_user_name);
  }
}

/**
 * Generates a random color based on username
 */
function generateRandomColor(username: string): string {
  // Simple hash function for consistent color per username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Convert to hex color
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
}

export function getTwitchEventSubClient(): WebSocket | null {
  return twitchEventSubClient;
}
