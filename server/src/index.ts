// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createHttpServer } from 'node:http';
import { TwitchAuthManager } from './services/TwitchAuthManager'; // Ensure path is correct
import { initializeSocketIO, getIO } from './services/SocketManager';
import { connectToTwitchEventSub, getTwitchEventSubClient } from './services/TwitchEventSub';
import { createMainRouter } from './routes';
import * as config from './config'; // Import all from config/index.ts
import { Bet } from './types/app'; // For shared state type
import WebSocket from 'ws'; // For type checking twitchEventSubClient

async function startServer() {
  if (!config.validateTwitchConfig()) {
    // Validate essential Twitch config from .env
    process.exit(1);
  }

  const app = express();
  const httpServer = createHttpServer(app);

  // Shared state for betting (passed as objects to allow mutation by reference)
  const bettingState = { isOpen: false };
  const currentBets: { current: Bet[] } = { current: [] };

  // Initialize Auth Manager
  const authManager = new TwitchAuthManager(
    config.TWITCH_CLIENT_ID!, // Use non-null assertion after validation
    config.TWITCH_CLIENT_SECRET!,
    config.TWITCH_REDIRECT_URI,
    config.TWITCH_SCOPES_ARRAY
  );
  await authManager.initialize(); // Load stored tokens

  // Initialize Socket.IO (pass shared state objects)
  const io = initializeSocketIO(httpServer, bettingState, currentBets);

  // Middleware
  app.use(express.json());

  // Setup Routes (pass authManager and shared state objects)
  app.use('/', createMainRouter(authManager, bettingState, currentBets));

  // Basic root route (can also be in routes/index.ts)
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

  httpServer.listen(config.PORT, () => {
    console.log(`DeskRat Race Server is running on ${config.SERVER_BASE_URL}`);
    console.log(`Twitch Client ID: ${config.TWITCH_CLIENT_ID ? 'Loaded' : 'MISSING!'}`);
    console.log(`Broadcaster User ID: ${config.YOUR_BROADCASTER_ID ? 'Loaded' : 'MISSING!'}`);

    // Connect to Twitch EventSub (pass authManager and IO instance)
    // Pass the bettingState and currentBets objects so EventSub handler can modify them
    connectToTwitchEventSub(authManager, io, bettingState, currentBets);
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
