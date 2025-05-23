# DeskRat Race - Twitch Starting Soon Game

Welcome to the DeskRat Race! This is a fun, interactive game designed to be used as a "Stream Starting Soon" scene for Twitch streamer **thedeskrat**. It features a dynamic race between rats named after channel subscribers, with plans for channel point betting and other interactive features.

## ✨ Features

- **Dynamic Rat Racers:** Rats are populated dynamically from the streamer's Twitch subscriber list.
- **Interactive Race Animation:** A visual race displayed on a canvas.
- **Backend Server:** Built with Node.js, Express, and TypeScript.
- **Twitch API Integration:**
  - Fetches subscriber lists.
  - Programmatic OAuth2 token management (access and refresh tokens) for server-side API calls.
  - Twitch EventSub WebSocket client for real-time event listening (e.g., for channel point redemptions).
- **Real-time Frontend Updates:** (Planned) Using Socket.IO for communication between backend and frontend game client.
- **Modern Frontend:** Built with React (Vite) and TypeScript.
- **Styling:** Using `shadcn/ui` and Tailwind CSS for a clean, nerdy, and retro vibe.
- **Channel Point Betting System (WIP):**
  - Viewers will be able to use channel points to bet on a winning rat.
  - Backend logic to handle redemptions and determine winners.

## 🚀 Tech Stack

**Backend (in `server/` directory):**

- Node.js
- Express.js
- TypeScript
- Socket.IO (for client-server communication)
- `ws` (for Twitch EventSub WebSocket client)
- Axios (for HTTP requests to Twitch API)
- `dotenv` (for environment variable management)
- `TwitchAuthManager` (custom class for OAuth token handling)

**Frontend (in `client/` directory):**

- React
- Vite
- TypeScript
- React Router (for SPA routing, if used beyond a single page)
- `shadcn/ui`
- Tailwind CSS
- Socket.IO Client (to connect to the backend)

## 📋 Prerequisites

- Node.js (v18.x or higher recommended)
- npm or yarn
- A Twitch Developer Application (for Client ID, Client Secret)
- Twitch Account (for testing as the broadcaster)

## 🛠️ Setup & Installation

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/joshgarza/ratrace
    cd ratrace
    ```

2.  **Backend Setup (`server/`):**

    - Navigate to the server directory: `cd server`
    - Install dependencies: `npm install` (or `yarn install`)
    - **Twitch Developer Application:**
      - Go to [dev.twitch.tv](https://dev.twitch.tv/) -> Your Console -> Applications -> Register Your Application.
      - Set a name (e.g., "DeskRat Race Game").
      - Add an **OAuth Redirect URI**. For local development, this will be `http://localhost:<YOUR_BACKEND_PORT>/auth/twitch/callback` (e.g., `http://localhost:3001/auth/twitch/callback` if your backend runs on port 3001).
      - Note your **Client ID** and generate/note a **Client Secret**.
    - **Environment Variables:**

      - Create a `.env` file in the `server/` directory by copying `.env.example` (you should create this example file).
        ```bash
        cp .env.example .env
        ```
      - Fill in the `.env` file with your credentials:

        ```env
        # Server Configuration
        PORT=3001 # Or your desired backend port
        SERVER_BASE_URL=http://localhost:3001 # Must match the port above

        # Twitch Application Credentials
        TWITCH_CLIENT_ID=your_twitch_client_id
        TWITCH_CLIENT_SECRET=your_twitch_client_secret

        # Your Twitch User Information (as the Broadcaster)
        YOUR_TWITCH_USER_ID=your_numerical_twitch_id # Your broadcaster ID

        # Twitch Scopes required by the application
        TWITCH_SCOPES="channel:read:subscriptions channel:read:redemptions user:read:email" # Add more as needed

        # Optional: For Channel Point Betting Feature
        TWITCH_CHANNEL_POINT_REWARD_ID= # ID of the custom reward for betting
        ```

    - **(Optional) `tokens.json`:** This file will be created automatically by the `TwitchAuthManager` in the `server/` directory to store OAuth tokens. **Ensure `tokens.json` is added to your `server/.gitignore` file.**
    - **(Optional) `nodemon.json`:** If you're using `nodemon` for development, create a `nodemon.json` in `server/` to ignore `tokens.json` and watch only `src`:
      ```json
      {
        "watch": ["src"],
        "ext": "ts,json",
        "ignore": ["src/**/*.spec.ts", "tokens.json", "dist/*"],
        "exec": "npm run build && node dist/index.js"
      }
      ```

3.  **Frontend Setup (`client/`):**
    - Navigate to the client directory: `cd ../client` (from `server/`) or `cd client` (from project root)
    - Install dependencies: `npm install` (or `yarn install`)
    - **Vite Configuration:** Ensure your `client/vite.config.ts` has a proxy setup if your client dev server and backend server run on different ports, to forward API requests (like `/api/subscribers` or Socket.IO connections) to the backend.
      ```typescript
      // client/vite.config.ts example snippet
      server: {
        proxy: {
          '/api': { // For REST API calls
            target: 'http://localhost:3001', // Your backend server URL
            changeOrigin: true,
          },
          '/socket.io': { // For Socket.IO
            target: 'ws://localhost:3001', // Your backend WebSocket URL
            ws: true,
          }
        }
      }
      ```

## ▶️ Running the Application

1.  **Start the Backend Server:**

    - Navigate to `server/`.
    - For development with auto-restart and TypeScript compilation:
      ```bash
      npm run dev
      ```
    - For production (after building with `npm run build`):
      ```bash
      npm start
      ```
    - **First Run - OAuth Authorization:**

      - The server console will log if an initial access token is missing.
      - If prompted, open your browser and navigate to `http://localhost:<YOUR_BACKEND_PORT>/auth/twitch` (e.g., `http://localhost:3001/auth/twitch`).
      - Authorize the application with your Twitch account.
      - You should be redirected back, and the server will obtain and store the tokens in `server/tokens.json`.

    - **Get User Access Token and Refresh Token**
    - `twitch token -u -s "channel:read:subscriptions channel:manage:redemptions user:read:email"`
    - Save the relevant information in `tokens.json`

2.  **Start the Frontend Development Server:**
    - Navigate to `client/`.
    - Run:
      ```bash
      npm run dev
      ```
    - Open your browser to the URL provided by Vite (usually `http://localhost:5173`).

## ⚙️ Environment Variables (`server/.env`)

Create a `.env` file in the `server/` directory with the following variables:

```env
# Server Configuration
PORT=3001
SERVER_BASE_URL=http://localhost:3001

# Twitch Application Credentials from dev.twitch.tv
TWITCH_CLIENT_ID=YOUR_TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET=YOUR_TWITCH_CLIENT_SECRET

# Your Twitch User Information (as the Broadcaster)
YOUR_TWITCH_USER_ID=YOUR_NUMERICAL_TWITCH_ID

# Twitch OAuth Scopes (space-separated list)
TWITCH_SCOPES="channel:read:subscriptions channel:read:redemptions user:read:email"

# Optional: For Channel Point Betting Feature - The ID of your custom Channel Point reward
TWITCH_CHANNEL_POINT_REWARD_ID=
```

**Important:** Add `tokens.json` (generated in `server/`) and `.env` files to your `.gitignore` to avoid committing sensitive credentials.

## 📁 Project Structure (Simplified)

```
deskrat-race/
├── client/         # React Frontend (Vite, shadcn/ui, Tailwind)
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   └── RatRaceGame.tsx
│   │   │   └── routes/
│   │   │       └── _index.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── server/         # Node.js Backend (Express, TypeScript, Socket.IO, EventSub)
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   └── twitchConfig.ts
│   │   ├── services/
│   │   │   ├── TwitchAuthManager.ts
│   │   │   ├── TwitchEventSub.ts
│   │   │   └── SocketManager.ts
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── authRoutes.ts
│   │   │   └── apiRoutes.ts
│   │   ├── types/
│   │   │   ├── app.ts
│   │   │   └── twitch.ts
│   │   └── index.ts        # Main server entry point
│   ├── .env
│   ├── nodemon.json (optional)
│   ├── tsconfig.json
│   └── package.json
└── README.md
```

## 🔑 Key Backend Components

- **`src/index.ts`:** Main server entry point, initializes Express, HTTP server, Socket.IO, AuthManager, and EventSub connection.
- **`src/config/`:** Manages loading and exporting environment variables and configurations.
- **`src/services/TwitchAuthManager.ts`:** Handles all Twitch OAuth2 token logic, including fetching, storing (in `tokens.json`), and refreshing tokens.
- **`src/services/TwitchEventSub.ts`:** Manages the WebSocket client connection to Twitch EventSub, subscribes to events (like channel point redemptions), and processes incoming notifications.
- **`src/services/SocketManager.ts`:** Manages the application's own Socket.IO server for real-time communication with the frontend game client.
- **`src/routes/`:** Defines API and authentication routes for the Express application.
- **`src/types/`:** Contains TypeScript interface definitions for cleaner data handling.

## 🔮 Future Enhancements / TODO

- **Channel Point Betting:**
  - [ ] Fully implement parsing of user bet input from channel point redemptions.
  - [ ] Robust logic for opening/closing betting windows.
  - [ ] Determine and announce winners.
  - [ ] Implement a "prize" system (e.g., custom points, leaderboard).
- **Power-Ups:** Allow chat to use channel points for in-race power-ups (Mario Kart style).
- **Visual Polish:**
  - More advanced rat sprites (e.g., simple animation).
  - Better track design.
  - Sound effects.
- **Chat Bot Integration:** For announcements, bet confirmations, etc.
- **Error Handling:** More comprehensive error handling and user feedback.
- **Security:**
  - Proper CSRF protection for OAuth state parameter.
  - Restrict Socket.IO CORS origin in production.
- **Testing:** Implement unit and integration tests.

## 🤝 Contributing

Details on contributing will be added later. For now, feel free to fork and experiment!

## 📄 License

This project is licensed under the MIT License - see the LICENSE.md file for details.
