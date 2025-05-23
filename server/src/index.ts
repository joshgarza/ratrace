// src/index.ts
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { createServer as createHttpServer } from 'node:http';
import { TwitchAuthManager } from './services/TwitchAuthManager';
import { TwitchApiService } from './services/TwitchApiService';
import { initializeSocketIO, getIO } from './services/SocketManager';
import { connectToTwitchEventSub, getTwitchEventSubClient } from './services/TwitchEventSub';
import { createMainRouter } from './routes';
import * as config from './config'; // Import all from config/index.ts
import { RaceParticipant } from './types/app'; // Updated to RaceParticipant
import WebSocket from 'ws'; // For type checking twitchEventSubClient
import cors from 'cors';
import axios from 'axios';

async function startServer() {
  if (!config.validateTwitchConfig()) {
    // Validate essential Twitch config from .env
    process.exit(1);
  }

  const app = express();
  const httpServer = createHttpServer(app);

  // Shared state for race registration
  const raceState = { isOpen: false }; // Match socket manager interface
  const participants = { current: [] as RaceParticipant[] };

  // Initialize Auth Manager as singleton
  const authManager = TwitchAuthManager.getInstance(
    config.TWITCH_CLIENT_ID!,
    config.TWITCH_CLIENT_SECRET!,
    config.TWITCH_REDIRECT_URI,
    config.TWITCH_SCOPES_ARRAY
  );
  await authManager.initialize();

  // Initialize Twitch API Service
  const twitchApiService = new TwitchApiService(authManager);

  // Initialize Socket.IO
  const io = initializeSocketIO(httpServer, raceState, participants);

  // Middleware
  // Configure CORS to allow credentials and specific origin
  app.use(cors({
    origin: 'http://localhost:5174', // Client origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Setup Routes
  app.use('/', createMainRouter(authManager, twitchApiService, raceState, participants));

  // Basic root route
  app.get('/', (req: Request, res: Response) => {
    res.send('DeskRat Race Server (TypeScript Refactored) is running!');
  });

  // Global error handler (example)
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Global Error Handler:', err.stack);
    res.status(500).send('Something broke!');
  });

  // Check for initial token and guide authorization if needed
  const initialToken = await authManager.getValidAccessToken();
  if (!initialToken) {
    console.warn('---------------------------------------------------------------------------');
    console.warn('Twitch Access Token not available or invalid after initial check.');
    console.warn(`Please authorize by visiting: ${config.SERVER_BASE_URL}/auth/twitch`);
    console.warn('---------------------------------------------------------------------------');
  } else {
    console.log('Twitch Access Token is available.');
  }

  // Improved route to force re-authentication
  app.get('/auth/reauth', (req: Request, res: Response) => {
    try {
      console.log('Re-auth request received from client browser');

      // Clear any existing tokens before generating new auth URL
      authManager.clearTokens();

      // Generate the authorization URL
      const authUrl = authManager.getAuthorizationUrl();
      console.log('Generated auth URL for Twitch:', authUrl);

      // Simply redirect the browser to Twitch's auth page
      // The browser will handle the redirect naturally
      res.redirect(authUrl);
    } catch (error) {
      console.error('Error in re-auth endpoint:', error);
      res.status(500).send('Failed to initiate authentication. Please try again later.');
    }
  });

  // Auth callback handler - improve the redirect path
  app.get('/auth/callback', (async (req: Request, res: Response) => {
    console.log('Auth callback received from Twitch with code');
    const { code } = req.query;

    if (!code) {
      console.error('No code provided in callback from Twitch');
      return res.redirect('http://localhost:5174/?error=no_code');
    }

    try {
      console.log('Exchanging code for tokens...');
      const success = await authManager.exchangeCodeForTokens(code as string);
      if (success) {
        console.log('Token exchange successful');

        // Validate token to log available scopes
        try {
          const token = await authManager.getValidAccessToken();
          if (token) {
            const validateResponse = await axios.get('https://id.twitch.tv/oauth2/validate', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log('Token scopes:', validateResponse.data.scopes);
            console.log('Token user_id:', validateResponse.data.user_id);

            // Check if we have the required scopes
            const requiredScopes = ['user:read:chat', 'channel:bot'];
            const missingScopes = requiredScopes.filter(
              scope => !validateResponse.data.scopes.includes(scope)
            );

            if (missingScopes.length > 0) {
              console.warn('Missing required scopes:', missingScopes);
            }
          }
        } catch (validateError) {
          console.error('Error validating token:', validateError);
        }

        // Redirect back to the client application
        res.redirect('http://localhost:5174/?auth=success');
      } else {
        console.error('Token exchange failed');
        res.redirect('http://localhost:5174/?error=token_exchange_failed');
      }
    } catch (error) {
      console.error('Error in auth callback:', error);
      res.redirect('http://localhost:5174/?error=auth_failed');
    }
  }) as RequestHandler);

  // Protected route example
  app.get('/api/protected', (async (req: Request, res: Response) => {
    try {
      const accessToken = await authManager.getValidAccessToken();
      if (!accessToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({ message: 'Success', token: accessToken });
    } catch (error) {
      console.error('Error getting access token:', error);
      res.status(401).json({ error: 'Unauthorized' });
    }
  }) as RequestHandler);

  httpServer.listen(config.PORT, () => {
    console.log(`DeskRat Race Server is running on ${config.SERVER_BASE_URL}`);
    console.log(`Twitch Client ID: ${config.TWITCH_CLIENT_ID ? 'Loaded' : 'MISSING!'}`);
    console.log(`Broadcaster User ID: ${config.YOUR_BROADCASTER_ID ? 'Loaded' : 'MISSING!'}`);

    // Connect to Twitch EventSub (pass authManager and IO instance)
    // Pass the raceState and participants objects so EventSub handler can modify them
    connectToTwitchEventSub(authManager, io, raceState, participants);
  });

  // Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}. Closing server gracefully.`);
      const eventSubClient = getTwitchEventSubClient();
      if (eventSubClient && eventSubClient.readyState === WebSocket.OPEN) {
        console.log('Closing Twitch EventSub WebSocket connection...');
        eventSubClient.close(1000, 'Server shutting down');
      }
      // Ensure betting reward is disabled on shutdown
      if (config.CHANNEL_POINT_REWARD_ID_FOR_BETS && initialToken /* only if we had a token to manage it */) {
        console.log('Server shutting down: Attempting to disable betting reward.');
        await twitchApiService.disableCustomReward(config.CHANNEL_POINT_REWARD_ID_FOR_BETS);
      }
      io.close(() => {
        // Close Socket.IO connections
        console.log('Socket.IO server closed.');
      });
      httpServer.close(() => {
        console.log('HTTP server closed.');
        // Determine exit code based on signal
        const signalCode = signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 0;
        process.exit(128 + signalCode);
      });
      // Force exit if server hangs during close
      setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000).unref(); // 10 seconds timeout
    });
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
