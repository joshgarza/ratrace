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

const TOKEN_FILE_PATH = path.join(process.cwd(), 'tokens.json');

export class TwitchAuthManager {
  private static instance: TwitchAuthManager;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string; // e.g., http://localhost:3000/auth/twitch/callback
  private scopes: string[];

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null; // Timestamp (in seconds since epoch)

  private constructor(clientId: string, clientSecret: string, redirectUri: string, scopes: string[]) {
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('TwitchAuthManager: Client ID, Client Secret, and Redirect URI are required.');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.scopes = scopes;
  }

  public static getInstance(clientId?: string, clientSecret?: string, redirectUri?: string, scopes?: string[]): TwitchAuthManager {
    if (!TwitchAuthManager.instance) {
      if (!clientId || !clientSecret || !redirectUri || !scopes) {
        throw new Error('TwitchAuthManager: First initialization requires all parameters');
      }
      TwitchAuthManager.instance = new TwitchAuthManager(clientId, clientSecret, redirectUri, scopes);
    }
    return TwitchAuthManager.instance;
  }

  // --- Token Persistence ---
  private async loadTokensFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
      const storedTokens: TokenStorage = JSON.parse(data);

      // Validate the tokens before using them
      this.accessToken = storedTokens.accessToken || null;
      this.refreshToken = storedTokens.refreshToken || null;

      // Handle different formats of expiresAt (string or number)
      if (storedTokens.expiresAt) {
        if (typeof storedTokens.expiresAt === 'number') {
      this.expiresAt = storedTokens.expiresAt;
        } else if (typeof storedTokens.expiresAt === 'string') {
          // Try to parse a string timestamp into a number
          try {
            // If it's a numeric string, convert it
            const parsedTime = parseInt(storedTokens.expiresAt, 10);
            if (!isNaN(parsedTime)) {
              this.expiresAt = parsedTime;
            } else {
              // If it's a date string, assume it's invalid and force token refresh
              this.expiresAt = null;
            }
          } catch (e) {
            console.error('Error parsing expiresAt as number:', e);
            this.expiresAt = null;
          }
        } else {
          this.expiresAt = null;
        }
      } else {
        this.expiresAt = null;
      }

      console.log('Tokens loaded from file. Access token:', this.accessToken ? 'exists' : 'missing',
                 'Refresh token:', this.refreshToken ? 'exists' : 'missing',
                 'Expires at:', this.expiresAt ? new Date(this.expiresAt * 1000).toISOString() : 'no expiry');
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

    // Validate the loaded access token
    if (this.accessToken) {
      if (this.isAccessTokenExpired()) {
      console.log('Initial access token is expired, attempting refresh.');
      await this.refreshAccessToken();
      } else {
        // Validate the token with Twitch to make sure it's still valid
        const isValid = await this.validateToken();
        if (!isValid) {
          console.log('Initial access token is invalid, attempting refresh.');
          await this.refreshAccessToken();
        }
      }
    }
  }

  // Validate the token with Twitch API
  private async validateToken(): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const response = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      });

      // If we get here, the token is valid
      if (response.data && response.data.expires_in) {
        // Update expiration time based on Twitch's response
        this.expiresAt = Math.floor(Date.now() / 1000) + response.data.expires_in;
        await this.saveTokensToFile();
      }

      return true;
    } catch (error) {
      console.error('Token validation failed:', this.formatAxiosError(error));
      return false;
    }
  }

  private isAccessTokenExpired(): boolean {
    if (!this.expiresAt) return true; // If no expiry, assume expired
    // Check if token expires in the next 5 minutes (300 seconds buffer)
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = currentTime >= this.expiresAt - 300;

    if (isExpired) {
      console.log(`Token expired or expiring soon. Current time: ${currentTime}, Expires at: ${this.expiresAt}, Difference: ${this.expiresAt - currentTime}s`);
    }

    return isExpired;
  }

  public getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      force_verify: 'true', // Force the user to re-authorize
    });
    if (state) {
      params.append('state', state);
    }
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  public async exchangeCodeForTokens(code: string): Promise<boolean> {
    try {
      console.log('Exchanging code for tokens with redirect URI:', this.redirectUri);
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

      console.log('Token exchange successful. Access token acquired. Expires in', expires_in, 'seconds');

      await this.saveTokensToFile();
      return true;
    } catch (error) {
      console.error('Error exchanging code for tokens:', this.formatAxiosError(error));
      this.clearTokens();
      return false;
    }
  }

  public async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.warn('No refresh token available to refresh access token.');
      this.clearTokens();
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
      console.log('Access token refreshed successfully. Expires in', expires_in, 'seconds');
      return true;
    } catch (error) {
      console.error('Error refreshing access token:', this.formatAxiosError(error));
      // If refresh fails (e.g., refresh token revoked), clear all tokens
      this.clearTokens();
      return false;
    }
  }

  public clearTokens(): void {
    console.log('Clearing all tokens');
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.saveTokensToFile();
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      console.log('No access token available');
      return null;
    }

    if (this.isAccessTokenExpired()) {
      console.log('Access token is expired, attempting refresh');
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        console.error('Failed to refresh token. Re-authentication required.');
        this.clearTokens(); // Clear invalid tokens
        return null;
      }
    } else {
      // If token is not expired, still validate it with Twitch occasionally
      const isValid = await this.validateToken();
      if (!isValid) {
        console.log('Token validation failed, attempting refresh');
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          console.error('Failed to refresh token after validation failed. Re-authentication required.');
          this.clearTokens();
          return null;
        }
      }
    }

    return this.accessToken;
  }

  public needsReAuth(): boolean {
    return !this.accessToken || !this.refreshToken || this.isAccessTokenExpired();
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
