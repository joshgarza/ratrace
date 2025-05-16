import { useLoaderData, Await, type LoaderFunctionArgs } from "react-router"; // Correct imports your equivalent for loaders
import RatRaceGame, { type RatData } from "~/components/RatRaceGame"; // Path to your component
import { useEffect, useState } from "react";

// Define the structure of a subscriber from your API
interface Subscriber {
  userId: string;
  userName: string;
  userLogin: string;
  tier: string;
  isGift: boolean;
}

interface ApiSubscribersResponse {
  total: number;
  points: number;
  subscribers: Subscriber[];
}

// Loader function to fetch subscribers from your Node.js API server
// This runs on the server-side in a Remix-style setup, or you'd do client-side fetch.
// For simplicity now, let's assume client-side fetching if loaders are complex to set up immediately.
// If using Remix loaders:
// export async function loader({ request }: LoaderFunctionArgs) {
//   try {
//     // IMPORTANT: This fetch happens from your Remix server to your API server.
//     // Ensure your API server (localhost:3000) is running.
//     // In production, this URL would be your API server's deployed address.
//     const response = await fetch('http://localhost:3000/api/subscribers');
//     if (!response.ok) {
//       console.error("Failed to fetch subscribers:", response.status, await response.text());
//       // Return empty or default data to prevent app crash
//       return { subscribers: [], error: "Failed to load subscribers" };
//     }
//     const data: ApiSubscribersResponse = await response.json();
//     const rats: RatData[] = data.subscribers.map(sub => ({
//       id: sub.userId,
//       name: sub.userName,
//       // Add other properties if needed by RatRaceGame
//     }));
//     return { rats };
//   } catch (error) {
//     console.error("Error in loader:", error);
//     return { subscribers: [], error: "Error fetching subscribers" };
//   }
// }

export default function Index() {
  // If using Remix loaders:
  // const { rats, error } = useLoaderData<typeof loader>();

  // --- For Client-Side Fetching (simpler to start if not fully on Remix loaders yet) ---
  const [rats, setRats] = useState<RatData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSubscribers() {
      setIsLoading(true);
      setError(null);
      try {
        // This fetch happens from the client's browser to your API server.
        // Ensure your API server (localhost:3000) is running and accessible.
        // If Vite dev server and API server are on different ports, configure Vite proxy.
        const response = await fetch('/api/subscribers'); // Assumes proxy or same origin
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        const data: ApiSubscribersResponse = await response.json();
        const mappedRats: RatData[] = data.subscribers.map(sub => ({
          id: sub.userId,
          name: sub.userName,
        }));
        setRats(mappedRats);
      } catch (err: any) {
        setError(err.message || "Error fetching subscribers");
        setRats([ // Fallback to hardcoded rats on error for development
            { id: "1", name: "Ratty (Fallback)" },
            { id: "2", name: "Cheeser (Fallback)" },
            { id: "3", name: "Squeaky (Fallback)" },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSubscribers();
  }, []);
  // --- End Client-Side Fetching ---


  if (isLoading) {
    return <div>Loading racers...</div>;
  }

  if (error) {
    // Still render the game with fallback/empty rats if there's an error
    // So the "Starting Soon" screen isn't blank.
    console.error("Error loading subscribers for race:", error);
  }

  // Use a few hardcoded rats if the fetched list is empty and no error, or for initial dev
  const displayRats = rats.length > 0 ? rats : [
    { id: "hc1", name: "DeskRunner" },
    { id: "hc2", name: "StreamSnacker" },
    { id: "hc3", name: "PixelPacer" },
  ];


  return (
    <div style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#222', color: 'white', minHeight: '100vh', paddingTop: '20px' }}>
      <h1>The DeskRat Race!</h1>
      <p>Starting Soon...</p>
      {error && <p style={{color: 'red'}}>Error loading subscriber list: {error}. Showing default racers.</p>}
      <RatRaceGame racers={displayRats} />
    </div>
  );
}