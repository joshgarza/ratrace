// src/routes/apiRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import { TwitchAuthManager } from '../services/TwitchAuthManager'; // Adjust path
import { TWITCH_CLIENT_ID, YOUR_BROADCASTER_ID, SERVER_BASE_URL } from '../config';
import { TwitchSubscriptionsResponse, TwitchSubscription } from '../types/twitch';
import { Bet } from '../types/app';
import { emitBettingStatus, emitRaceWinner } from '../services/SocketManager';

// Shared state needs to be passed or managed through a shared module/context
// This is a simplified example; for larger apps, consider a proper state management solution or dependency injection.

export const createApiRoutes = (
  authManager: TwitchAuthManager,
  bettingState: { isOpen: boolean }, // Pass the mutable state object
  currentBets: { current: Bet[] } // Pass the mutable currentBets array object
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
      const subscribers = apiResponse.data.data.map((sub: TwitchSubscription) => ({
        /* ... */
      })); // Keep your mapping
      res.json({ total: apiResponse.data.total, points: apiResponse.data.points, subscribers });
    } catch (error) {
      // ... (your existing error handling for this route) ...
      console.error('ApiRoutes: Error fetching subscribers:', error);
      next(error); // Example: pass to a global error handler
    }
  });

  // Betting Control API Endpoints
  router.post('/bets/open', (req: Request, res: Response) => {
    console.log('ApiRoutes: Opening betting.');
    bettingState.isOpen = true;
    currentBets.current = []; // Clear previous bets
    emitBettingStatus(true, 'Bets are now OPEN!');
    res.json({ message: 'Betting is now open.' });
  });

  router.post('/bets/close', (req: Request, res: Response) => {
    console.log('ApiRoutes: Closing betting.');
    bettingState.isOpen = false;
    emitBettingStatus(false, 'Bets are now CLOSED!');
    res.json({ message: 'Betting is now closed.' });
  });

  router.post('/race/winner', (req: Request, res: Response): void => {
    const { winningRatName } = req.body as { winningRatId?: string; winningRatName: string };
    if (!winningRatName) {
      res.status(400).json({ error: 'winningRatName is required.' });
    }
    console.log(`ApiRoutes: Race winner declared - ${winningRatName}`);
    bettingState.isOpen = false; // Ensure betting is closed

    const winners = currentBets.current.filter(
      (bet) => bet.userInput.toLowerCase().includes(winningRatName.toLowerCase()) // TODO: Improve parsing
    );
    console.log(
      'ApiRoutes: Winning bettors:',
      winners.map((w) => w.userName)
    );
    emitRaceWinner(
      winningRatName,
      winners.map((w) => w.userName)
    );
    currentBets.current = []; // Clear bets
    res.json({ message: `Winner ${winningRatName} processed.`, winners });
  });

  return router;
};
