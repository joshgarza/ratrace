// src/routes/index.ts
import { Router } from 'express';
import { createAuthRoutes } from './authRoutes';
import { createApiRoutes } from './apiRoutes';
import { TwitchAuthManager } from '../services/TwitchAuthManager';
import { Bet } from '../types/app';

export const createMainRouter = (
  authManager: TwitchAuthManager,
  bettingState: { isOpen: boolean },
  currentBets: { current: Bet[] }
) => {
  const router = Router();
  router.use('/auth', createAuthRoutes(authManager, bettingState, currentBets));
  router.use('/api', createApiRoutes(authManager, bettingState, currentBets));
  // Add other top-level routes here if needed
  return router;
};
