// src/TwitchAuthManager.ts
import axios, { AxiosError } from 'axios';
import fs from 'fs/promises'; // For reading/writing tokens.json
import path from 'path';
import querystring from 'querystring'; // For form-urlencoded data

// Define the structure for our token storage
interface TokenStorage {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // Timestamp when the access token expires
}

const TOKEN_FILE_PATH = path.join(__dirname, '../..', 'tokens.json'); // Store tokens.json in project root (outside src/dist)

export class TwitchAuthManager {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string; // e.g., http://localhost:3000/auth/twitch/callback
  private scopes: string[];

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null; // Timestamp (in seconds since epoch)

  constructor(clientId: string, clientSecret: string, redirectUri: string, scopes: string[]) {
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('TwitchAuthManager: Client ID, Client Secret, and Redirect URI are required.');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.scopes = scopes;
  }

  // --- Token Persistence ---
  private async loadTokensFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
      const storedTokens: TokenStorage = JSON.parse(data);
      this.accessToken = storedTokens.accessToken;
      this.refreshToken = storedTokens.refreshToken;
      this.expiresAt = storedTokens.expiresAt;
      console.log('Tokens loaded from file.');
    } catch (error) {
      // If file doesn't exist or is invalid, it's fine, we'll get new tokens.
      console.warn('Could not load tokens from file or file not found. Will attempt to get new tokens if needed.');
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;
    }
  }

  private async saveTokensToFile(): Promise<void> {
    const tokenData: TokenStorage = {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt,
    };
    try {
      await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(tokenData, null, 2), 'utf-8');
      console.log('Tokens saved to file.');
    } catch (error) {
      console.error('Error saving tokens to file:', error);
    }
  }

  // --- Core Logic ---
  public async initialize(): Promise<void> {
    await this.loadTokensFromFile();
    // Optionally, validate the loaded access token here immediately
    if (this.accessToken && this.isAccessTokenExpired()) {
      console.log('Initial access token is expired, attempting refresh.');
      await this.refreshAccessToken();
    }
  }

  private isAccessTokenExpired(): boolean {
    if (!this.expiresAt) return true; // If no expiry, assume expired
    // Check if token expires in the next minute (60 seconds buffer)
    return Date.now() / 1000 >= this.expiresAt - 60;
  }

  public getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
    });
    if (state) {
      params.append('state', state);
    }
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  public async exchangeCodeForTokens(code: string): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://id.twitch.tv/oauth2/token',
        querystring.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.expiresAt = Math.floor(Date.now() / 1000) + expires_in;
      await this.saveTokensToFile();
      console.log('Successfully exchanged code for tokens.');
      return true;
    } catch (error) {
      console.error('Error exchanging code for tokens:', this.formatAxiosError(error));
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;
      await this.saveTokensToFile(); // Save null tokens
      return false;
    }
  }

  public async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.warn('No refresh token available to refresh access token.');
      this.accessToken = null; // Ensure access token is also cleared
      this.expiresAt = null;
      await this.saveTokensToFile();
      return false;
    }

    console.log('Attempting to refresh access token...');
    try {
      const response = await axios.post(
        'https://id.twitch.tv/oauth2/token',
        querystring.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      this.accessToken = access_token;
      // Twitch may or may not return a new refresh token. If it does, update it.
      if (refresh_token) {
        this.refreshToken = refresh_token;
      }
      this.expiresAt = Math.floor(Date.now() / 1000) + expires_in;
      await this.saveTokensToFile();
      console.log('Access token refreshed successfully.');
      return true;
    } catch (error) {
      console.error('Error refreshing access token:', this.formatAxiosError(error));
      // If refresh fails (e.g., refresh token revoked), clear all tokens
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;
      await this.saveTokensToFile();
      return false;
    }
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (!this.accessToken || this.isAccessTokenExpired()) {
      console.log('Access token missing or expired, attempting refresh.');
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        console.error('Failed to refresh token. Manual authorization might be needed.');
        return null; // Could not get a valid token
      }
    }
    return this.accessToken;
  }

  private formatAxiosError(error: any): any {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      return {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      };
    }
    return error;
  }
}
