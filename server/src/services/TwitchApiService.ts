// src/services/TwitchApiService.ts
import axios, { AxiosError } from 'axios';
import { TwitchAuthManager } from './TwitchAuthManager'; // Assuming it's in the same directory
import { TWITCH_CLIENT_ID, YOUR_BROADCASTER_ID } from '../config'; // Use centralized config

export class TwitchApiService {
  private authManager: TwitchAuthManager;
  private helixBaseUrl: string = 'https://api.twitch.tv/helix';

  constructor(authManager: TwitchAuthManager) {
    this.authManager = authManager;
    if (!YOUR_BROADCASTER_ID) {
      console.error('TwitchApiService: YOUR_BROADCASTER_ID is not defined in config. Some functionalities might fail.');
      // Depending on strictness, you might throw an error here
    }
  }

  private async getHeaders(): Promise<{ 'Client-ID': string; Authorization: string; 'Content-Type'?: string } | null> {
    const accessToken = await this.authManager.getValidAccessToken();
    if (!accessToken) {
      console.error('TwitchApiService: No valid access token available for API call.');
      return null;
    }
    if (!TWITCH_CLIENT_ID) {
      console.error('TwitchApiService: TWITCH_CLIENT_ID is not configured.');
      return null; // Or throw
    }
    return {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json', // Default for PATCH/POST, can be overridden
    };
  }

  private formatAxiosError(error: any, context?: string): any {
    const serviceContext = context || 'TwitchApiService';
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      return {
        context: serviceContext,
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        url: axiosError.config?.url,
        method: axiosError.config?.method,
      };
    }
    return { context: serviceContext, message: (error as Error).message, errorObject: error };
  }

  /**
   * Updates the status of a custom channel point reward.
   * @param rewardId The ID of the custom reward to update.
   * @param isEnabled Set to true to enable (unpause), false to disable (pause).
   * @param optionalTitle Optional: New title for the reward.
   * @param optionalCost Optional: New cost for the reward.
   * @returns boolean True if successful, false otherwise.
   */
  public async updateCustomReward(
    rewardId: string,
    updates: { is_enabled?: boolean; title?: string; cost?: number /* add other updatable fields as needed */ }
  ): Promise<boolean> {
    if (!YOUR_BROADCASTER_ID) {
      console.error('TwitchApiService.updateCustomReward: Broadcaster ID is not configured.');
      return false;
    }
    if (!rewardId) {
      console.error('TwitchApiService.updateCustomReward: rewardId is required.');
      return false;
    }

    const headers = await this.getHeaders();
    if (!headers) return false;

    const params = {
      broadcaster_id: YOUR_BROADCASTER_ID,
      id: rewardId,
    };

    console.log(`TwitchApiService: Updating reward ${rewardId} with:`, updates);
    try {
      const response = await axios.patch(
        `${this.helixBaseUrl}/channel_points/custom_rewards`,
        updates, // The body of the request containing fields to update
        {
          headers: headers,
          params: params, // broadcaster_id and id are query parameters for PATCH
        }
      );

      if (response.status === 200) {
        console.log(`TwitchApiService: Successfully updated custom reward ${rewardId}.`);
        // console.log("TwitchApiService: Update response data:", response.data);
        return true;
      } else {
        console.warn(`TwitchApiService: Unexpected status code ${response.status} when updating reward ${rewardId}.`);
        return false;
      }
    } catch (error) {
      console.error(
        `TwitchApiService: Error updating custom reward ${rewardId}:`,
        this.formatAxiosError(error, 'updateCustomReward')
      );
      return false;
    }
  }

  /**
   * Enables a custom channel point reward.
   * @param rewardId The ID of the custom reward.
   * @returns boolean True if successful, false otherwise.
   */
  public async enableCustomReward(rewardId: string): Promise<boolean> {
    console.log(`TwitchApiService: Enabling reward ${rewardId}`);
    return this.updateCustomReward(rewardId, { is_enabled: true });
  }

  /**
   * Disables (pauses) a custom channel point reward.
   * @param rewardId The ID of the custom reward.
   * @returns boolean True if successful, false otherwise.
   */
  public async disableCustomReward(rewardId: string): Promise<boolean> {
    console.log(`TwitchApiService: Disabling reward ${rewardId}`);
    return this.updateCustomReward(rewardId, { is_enabled: false });
  }

  // You can add more methods here for other Twitch API interactions:
  // - Get custom rewards list (to find an ID if needed)
  // - Get user information
  // - etc.

  /**
   * Fetches the list of custom channel point rewards for the broadcaster.
   * @returns Array of reward objects or null if an error occurs.
   */
  public async getCustomRewards(): Promise<any[] | null> {
    if (!YOUR_BROADCASTER_ID) {
      console.error('TwitchApiService.getCustomRewards: Broadcaster ID is not configured.');
      return null;
    }
    const headers = await this.getHeaders();
    if (!headers) return null;

    console.log('TwitchApiService: Fetching custom rewards...');
    try {
      const response = await axios.get(`${this.helixBaseUrl}/channel_points/custom_rewards`, {
        headers: { ...headers, 'Content-Type': undefined }, // GET doesn't need Content-Type for body
        params: {
          broadcaster_id: YOUR_BROADCASTER_ID,
          only_manageable_rewards: true, // Typically you only want to see rewards you can manage
        },
      });
      if (response.status === 200 && response.data && response.data.data) {
        console.log(`TwitchApiService: Found ${response.data.data.length} custom rewards.`);
        return response.data.data;
      } else {
        console.warn(`TwitchApiService: Unexpected response when fetching rewards (Status: ${response.status}).`);
        return null;
      }
    } catch (error) {
      console.error(
        'TwitchApiService: Error fetching custom rewards:',
        this.formatAxiosError(error, 'getCustomRewards')
      );
      return null;
    }
  }
}
