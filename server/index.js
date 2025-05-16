// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON (if you plan to receive JSON in requests)
app.use(express.json());

// --- Twitch API Configuration ---
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN; // User Access Token for subscriber list
const YOUR_BROADCASTER_ID = process.env.YOUR_TWITCH_USER_ID;

if (!TWITCH_CLIENT_ID || !TWITCH_ACCESS_TOKEN || !YOUR_BROADCASTER_ID) {
    console.error("Missing Twitch API credentials in .env file!");
    process.exit(1); // Exit if critical env vars are missing
}

// --- API Endpoints ---

// Basic root route
app.get('/', (req, res) => {
    res.send('DeskRat Race Server is running!');
});

// Endpoint to get your subscribers
app.get('/api/subscribers', async (req, res) => {
    if (!TWITCH_ACCESS_TOKEN) {
        return res.status(401).json({ error: 'Twitch Access Token is not configured.' });
    }

    try {
        console.log(`Fetching subscribers for broadcaster ID: ${YOUR_BROADCASTER_ID}`);
        const response = await axios.get(`https://api.twitch.tv/helix/subscriptions`, {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${TWITCH_ACCESS_TOKEN}`
            },
            params: {
                broadcaster_id: YOUR_BROADCASTER_ID,
                first: 100 // Get up to 100 subscribers, Twitch API max per page
                // You might need to handle pagination for more than 100 subs
            }
        });

        // Extract just the usernames for simplicity, or send the whole data
        const subscribers = response.data.data.map(sub => ({
            userId: sub.user_id,
            userName: sub.user_name,
            userLogin: sub.user_login,
            tier: sub.tier,
            isGift: sub.is_gift
        }));

        res.json({
            total: response.data.total,
            points: response.data.points, // Sub points
            subscribers: subscribers
        });

    } catch (error) {
        console.error('Error fetching Twitch subscribers:');
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', error.response.data);
            res.status(error.response.status).json({
                message: "Error fetching subscribers from Twitch",
                details: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Request Error:', error.request);
            res.status(500).json({ message: "No response from Twitch API" });
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error:', error.message);
            res.status(500).json({ message: "Internal server error" });
        }
    }
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Twitch Client ID: ${TWITCH_CLIENT_ID ? 'Loaded' : 'MISSING!'}`);
    console.log(`Twitch Access Token: ${TWITCH_ACCESS_TOKEN ? 'Loaded' : 'MISSING!'}`);
    console.log(`Your Twitch User ID: ${YOUR_BROADCASTER_ID ? 'Loaded' : 'MISSING!'}`);
});