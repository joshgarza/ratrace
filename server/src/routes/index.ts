// src/routes/index.ts
import { Router } from 'express';
import { createAuthRoutes } from './authRoutes';
import { createApiRoutes } from './apiRoutes';
import { TwitchAuthManager } from '../services/TwitchAuthManager';
import { TwitchApiService } from '../services/TwitchApiService';
import { RaceParticipant } from '../types/app';

export const createMainRouter = (
  authManager: TwitchAuthManager,
  twitchApiService: TwitchApiService,
  raceState: { isOpen: boolean },
  participants: { current: RaceParticipant[] }
) => {
  const router = Router();
  router.use('/auth', createAuthRoutes(authManager, raceState, participants));
  router.use('/api', createApiRoutes(authManager, twitchApiService, raceState, participants));
  // Add other top-level routes here if needed
  return router;
};
