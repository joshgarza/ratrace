// src/routes/authRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { TwitchAuthManager } from '../services/TwitchAuthManager'; // Adjust path if needed
import { SERVER_BASE_URL } from '../config'; // For authUrl hint
import { connectToTwitchEventSub, getTwitchEventSubClient } from '../services/TwitchEventSub';
import { getIO } from '../services/SocketManager'; // To pass to EventSub
import WebSocket from 'ws';
import { RaceParticipant } from '../types/app';

// These will be initialized in index.ts and passed or accessed
// This is a bit tricky with module scope; consider passing authManager via middleware or app.locals
// For now, assuming authManager is a singleton initialized in index.ts and imported if not passed.
// A better way is dependency injection.

export const createAuthRoutes = (
  authManager: TwitchAuthManager,
  raceState: { isOpen: boolean }, // Pass shared race state
  participants: { current: RaceParticipant[] } // Pass shared participants
) => {
  const router = Router();

  router.get('/twitch', (req: Request, res: Response) => {
    const state = 'somerandomgeneratedstate'; // TODO: Implement proper state generation and validation
    const authorizationUrl = authManager.getAuthorizationUrl(state);
    console.log('AuthRoutes: Redirecting to Twitch for authorization...');
    res.redirect(authorizationUrl);
  });

  router.get('/twitch/callback', async (req: Request, res: Response): Promise<void> => {
    const { code, state, error, error_description } = req.query;
    // TODO: Validate state

    if (error) {
      console.error('AuthRoutes: Error from Twitch OAuth callback:', error, error_description);
      res.status(500).send(`Twitch OAuth Error: ${error_description || error}`);
      return;
    }
    if (!code || typeof code !== 'string') {
      res.status(400).send('No authorization code provided.');
      return;
    }

    console.log('AuthRoutes: Received authorization code, exchanging for tokens...');
    const success = await authManager.exchangeCodeForTokens(code);
    if (success) {
      console.log('AuthRoutes: OAuth successful! Tokens obtained and stored.');
      const eventSubClient = getTwitchEventSubClient();
      if (
        eventSubClient &&
        eventSubClient.readyState !== WebSocket.OPEN &&
        eventSubClient.readyState !== WebSocket.CONNECTING
      ) {
        console.log('AuthRoutes: Attempting to reconnect EventSub after successful OAuth.');
        connectToTwitchEventSub(authManager, getIO(), raceState, participants);
      } else if (!eventSubClient) {
        console.log('AuthRoutes: Attempting initial EventSub connection after successful OAuth.');
        connectToTwitchEventSub(authManager, getIO(), raceState, participants);
      }
      res.send('Authentication successful! You can close this window.');
      return;
    } else {
      res.status(500).send('Failed to exchange code for tokens. Check server logs.');
      return;
    }
  });

  return router;
};
