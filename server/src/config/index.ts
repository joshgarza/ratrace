// src/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT: number = parseInt(process.env.PORT || '3000', 10);
export const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${PORT}`;
export const TWITCH_REDIRECT_URI = `${SERVER_BASE_URL}/auth/twitch/callback`;

// Re-export Twitch configurations
export * from './twitchConfig';
