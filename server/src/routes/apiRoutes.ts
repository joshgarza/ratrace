// src/routes/apiRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import * as config from '../config';
import { TWITCH_CLIENT_ID, YOUR_BROADCASTER_ID, SERVER_BASE_URL, TWITCH_SCOPES_ARRAY } from '../config';
import { TwitchSubscriptionsResponse, TwitchSubscription } from '../types/twitch';
import { RaceParticipant } from '../types/app';
import { TwitchAuthManager } from '../services/TwitchAuthManager';
import { TwitchApiService } from '../services/TwitchApiService';
import { emitRegistrationStatus, emitRaceWinner, emitNewParticipant } from '../services/SocketManager';
import { TwitchChatMessageEvent } from '../types/twitch';

// Import the function to mock
import { handleRegistrationCommand } from '../services/TwitchEventSub';

export const createApiRoutes = (
  authManager: TwitchAuthManager,
  twitchApiService: TwitchApiService,
  raceState: { isOpen: boolean },
  participants: { current: RaceParticipant[] }
) => {
  const router = Router();

  router.get('/subscribers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const accessToken = await authManager.getValidAccessToken();
    if (!accessToken) {
      res.status(401).json({
        error: 'Twitch Access Token not available. Please re-authorize.',
        needsReAuth: true,
        authUrl: `${SERVER_BASE_URL}/auth/twitch`,
      });
      return;
    }
    try {
      console.log(`ApiRoutes: Fetching subscribers for ${YOUR_BROADCASTER_ID}`);
      const apiResponse = await axios.get<TwitchSubscriptionsResponse>(`https://api.twitch.tv/helix/subscriptions`, {
        headers: { 'Client-ID': TWITCH_CLIENT_ID!, Authorization: `Bearer ${accessToken}` },
        params: { broadcaster_id: YOUR_BROADCASTER_ID!, first: 100 },
      });
      const subscribers = apiResponse.data.data.map((sub: TwitchSubscription) => {
        return {
          userId: sub.user_id,
          userName: sub.user_name,
          userLogin: sub.user_login,
          tier: sub.tier,
          isGift: sub.is_gift,
        };
      });
      res.json({ total: apiResponse.data.total, points: apiResponse.data.points, subscribers });
    } catch (error) {
      console.error('ApiRoutes: Error fetching subscribers:', error);
      next(error);
    }
  });

  // Race Registration API Endpoints
  router.post('/registration/open', (req: Request, res: Response): void => {
    console.log('ApiRoutes: Opening race registration.');
    raceState.isOpen = true;
    participants.current = []; // Clear previous participants
    emitRegistrationStatus(true, 'Registration is now OPEN!');
    res.json({ message: 'Race registration is now open.' });
  });

  router.post('/registration/close', (req: Request, res: Response): void => {
    console.log('ApiRoutes: Closing race registration.');
    raceState.isOpen = false;
    emitRegistrationStatus(false, 'Registration is now CLOSED!');
    res.json({
      message: 'Race registration is now closed.',
      participantCount: participants.current.length
    });
  });

  router.get('/participants', (req: Request, res: Response): void => {
    res.json({
      isRegistrationOpen: raceState.isOpen,
      participants: participants.current
    });
  });

  router.post('/race/winner', (req: Request, res: Response): void => {
    const { winningRatName } = req.body as { winningRatId?: string; winningRatName: string };
    if (!winningRatName) {
      res.status(400).json({ error: 'winningRatName is required.' });
      return;
    }
    console.log(`ApiRoutes: Race winner declared - ${winningRatName}`);
    raceState.isOpen = false; // Ensure registration is closed

    // Find participant with matching name if exists
    const winnerIndex = participants.current.findIndex(
      p => p.userName.toLowerCase() === winningRatName.toLowerCase()
    );

    // Get list of all participant names for display
    const participantNames = participants.current.map(p => p.userName);

    // Emit winner event
    emitRaceWinner(winningRatName, participantNames);

    // Clear participants after race
    participants.current = [];

    res.json({
      message: `Winner ${winningRatName} processed.`,
      winnerFound: winnerIndex >= 0,
      participants: participantNames
    });
  });

  // Test endpoint for simulating chat messages (DEV ONLY)
  router.post('/test/chat-message', (req: Request, res: Response): void => {
    const { username = 'test_user', message = '!register' } = req.body as {
      username?: string;
      message?: string;
    };

    // Create a mock chat event
    const mockChatEvent: TwitchChatMessageEvent = {
      broadcaster_user_id: YOUR_BROADCASTER_ID || '12345',
      broadcaster_user_login: 'broadcaster',
      broadcaster_user_name: 'BroadcasterName',
      chatter_user_id: `user_${Date.now()}`, // Generate unique ID
      chatter_user_login: username.toLowerCase(),
      chatter_user_name: username,
      message: {
        text: message,
        fragments: [{
          type: 'text',
          text: message
        }]
      },
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`, // Random color
      badges: [],
      message_id: `msg_${Date.now()}`,
      message_type: 'chat',
      sent_at: new Date().toISOString()
    };

    console.log(`Test: Processing mock chat message from ${username}: "${message}"`);

    // Process the mock chat event
    handleRegistrationCommand(mockChatEvent);

    res.json({
      success: true,
      message: `Simulated chat message: ${username}: ${message}`,
      raceOpen: raceState.isOpen,
      participantCount: participants.current.length
    });
  });

  // Force re-authentication with new scopes (DEV ONLY)
  router.post('/test/reauth', (req: Request, res: Response): void => {
    // Clear tokens to force re-auth with new scopes
    authManager.clearTokens();
    res.json({
      success: true,
      message: "Tokens cleared. You must re-authenticate with new scopes.",
      authUrl: `${SERVER_BASE_URL}/auth/twitch`
    });
  });

  // Authentication diagnostic endpoint (DEV ONLY)
  router.get('/test/auth-status', async (req: Request, res: Response): Promise<void> => {
    const accessToken = await authManager.getValidAccessToken();

    res.json({
      needsAuth: authManager.needsReAuth(),
      clientInfo: {
        clientId: TWITCH_CLIENT_ID?.substring(0, 5) + '...',
        redirectUri: `${SERVER_BASE_URL}/auth/twitch/callback`,
        fullRedirectUri: config.TWITCH_REDIRECT_URI
      },
      scopes: TWITCH_SCOPES_ARRAY,
      serverBaseUrl: SERVER_BASE_URL,
      tokenStatus: {
        hasAccessToken: !!accessToken,
        tokenString: accessToken ? `${accessToken.substring(0, 5)}...` : null
      }
    });
  });

  // Debug redirect URI
  router.get('/test/redirect-uri', (req: Request, res: Response): void => {
    res.json({
      registeredRedirectUri: "Open your Twitch Developer Console to check",
      appRedirectUri: config.TWITCH_REDIRECT_URI,
      appBaseUrl: SERVER_BASE_URL,
      authCallbackPath: "/auth/twitch/callback",
      broadcaster_id: YOUR_BROADCASTER_ID,
      authUrl: authManager.getAuthorizationUrl("test-state")
    });
  });

  // Test endpoint for directly adding a participant (bypassing chat)
  router.post('/test/add-participant', (req: Request, res: Response): void => {
    const { username = 'test_user' } = req.body as { username?: string };

    if (!raceState.isOpen) {
      res.status(400).json({
        success: false,
        message: "Registration is closed. Open it first with /api/registration/open"
      });
      return;
    }

    // Check for duplicate
    const isDuplicate = participants.current.some(p =>
      p.userLogin.toLowerCase() === username.toLowerCase() ||
      p.userName.toLowerCase() === username.toLowerCase()
    );

    if (isDuplicate) {
      res.json({
        success: false,
        message: `${username} is already registered`,
        participantCount: participants.current.length,
        participants: participants.current.map(p => p.userName)
      });
      return;
    }

    // Create test participant
    const userId = `test_${Date.now()}`;
    const participant: RaceParticipant = {
      userId,
      userName: username,
      userLogin: username.toLowerCase(),
      registeredAt: new Date().toISOString(),
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
    };

    // Add to participants
    participants.current.push(participant);

    // Notify via socket
    emitNewParticipant(username);

    res.json({
      success: true,
      message: `${username} registered for the race`,
      participantCount: participants.current.length,
      participants: participants.current.map(p => p.userName)
    });
  });

  // Debug token scopes
  router.get('/test/validate-token', async (req: Request, res: Response): Promise<void> => {
    const accessToken = await authManager.getValidAccessToken();

    if (!accessToken) {
      res.status(401).json({
        success: false,
        message: "No valid access token",
        authUrl: `${SERVER_BASE_URL}/auth/reauth`
      });
      return;
    }

    try {
      // Validate token to see what scopes we have
      const response = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      res.json({
        success: true,
        token_data: response.data,
        required_scopes: {
          for_chat_messages: ['user:read:chat', 'channel:bot'],
          missing: response.data.scopes
            ? ['user:read:chat', 'channel:bot'].filter(scope => !response.data.scopes.includes(scope))
            : ['unknown']
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error validating token",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
};
