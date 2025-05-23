# DeskRat Race Server

## Setup for Twitch Chat Integration

### Requirements
- Node.js and npm
- Twitch Developer Application (register at https://dev.twitch.tv/console/apps)

### Configuration

1. In your Twitch Developer Console:
   - Add the following redirect URI: `http://localhost:3000/auth/callback`
   - Required scopes: `channel:read:subscriptions channel:read:redemptions user:read:email channel:moderate user:read:chat channel:bot`

2. Create a `.env` file in the `server` directory with the following:
```
PORT=3000
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
YOUR_BROADCASTER_ID=your_broadcaster_id
# Include all required scopes for chat and events
TWITCH_SCOPES=channel:read:subscriptions channel:read:redemptions user:read:email channel:moderate user:read:chat channel:bot
```

### Testing Chat Registration

1. Start the server: `npm run dev`
2. Start the client: `cd ../client && npm run dev`
3. In the web interface:
   - Click "Authorize with Twitch"
   - Follow the authentication flow
   - Check that the token has the proper scopes via `/api/test/validate-token`
   - Open race registration
   - Type `!register` in your Twitch chat to register

### Troubleshooting

- If EventSub subscriptions fail, check the token scopes using `/api/test/validate-token`
- Force re-authentication with `/api/test/reauth` if you need new scopes
- Use `/api/test/chat-message` endpoint to simulate chat messages without Twitch during development
- Use the test endpoints in the web interface for development testing

### EventSub Subscription Requirements

For the `channel.chat.message` subscription:
- Required scopes: `user:read:chat` and sometimes `channel:bot`
- Two IDs are required:
  - `broadcaster_user_id`: The channel where chat happens
  - `user_id`: The user whose messages you want to receive

See the [Twitch EventSub Documentation](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types#channelchatmessage) for more details.