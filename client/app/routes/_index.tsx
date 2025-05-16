import RatRaceGame, { type RatData } from "~/components/RatRaceGame"; // Ensure this path is correct
import { useEffect, useState } from "react";
// Shadcn UI components you might want for this page (e.g., a loading spinner)
// import { Skeleton } from "~/components/ui/skeleton"; // Example

// Define the structure of a subscriber from your API (remains the same)
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

// Fallback/Default Rats with some thematic names
const getFallbackRats = (reason?: string): RatData[] => {
    if (reason) console.log("Fallback Rats triggered:", reason);
    return [
        { id: "fb1", name: "PixelPacer", color: "#34D399" }, // Emerald green
        { id: "fb2", name: "CodeCritter", color: "#F97316" }, // Orange
        { id: "fb3", name: "SyntaxScurrier", color: "#8B5CF6" }, // Violet
        { id: "fb4", name: "GlitchRunner", color: "#EC4899" }, // Fuchsia
    ];
};

export default function IndexPage() {
  const [rats, setRats] = useState<RatData[]>(() => getFallbackRats("Initial component load."));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSubscribers() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/subscribers'); // Ensure your Vite proxy is set up
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status} - ${response.statusText}`);
        }
        const data: ApiSubscribersResponse = await response.json();
        const mappedRats: RatData[] = data.subscribers.map((sub) => ({
          id: sub.userId,
          name: sub.userName,
        }));
        setRats(mappedRats.length > 0 ? mappedRats : getFallbackRats("No subscribers found after fetch."));
      } catch (err: any) {
        console.error("Error fetching subscribers:", err);
        setError(err.message || "An unknown error occurred while fetching subscribers.");
        setRats(getFallbackRats(err.message || "Fetch error, using fallback."));
      } finally {
        setIsLoading(false);
      }
    }
    fetchSubscribers();
  }, []);

  // Determine which rats to display based on loading/error state
  const displayRats = isLoading ? getFallbackRats("Still loading...") : (rats.length > 0 ? rats : getFallbackRats("Loading finished, but no rats."));

  return (
    // For fonts, ensure you've imported them in your globals.css, e.g., VT323 or Press Start 2P
    // and set them in tailwind.config.js if you want to use font utilities like `font-pixel`.
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-['VT323',_sans-serif]"> {/* Example retro font */}
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-purple-400 animate-pulse-slow">
          {/* For a more pixelated look, you might use a pixel font class here */}
          The Desk<span className="text-orange-400">Rat</span> Race!
        </h1>
        <p className="text-xl sm:text-2xl text-slate-400 mt-3 tracking-wider">
          Stream Starting Soon... System Booting...
        </p>
      </header>

      <main className="w-full max-w-5xl p-2">
        {isLoading && (
          <div className="text-center py-10 flex flex-col items-center">
            <p className="text-2xl text-green-400 mb-4">Initializing Rat Racers...</p>
            {/* Example of using shadcn Skeleton for placeholders */}
            <div className="space-y-3 w-full max-w-md">
              {/* <Skeleton className="h-12 w-full bg-slate-700" />
              <Skeleton className="h-12 w-full bg-slate-700" />
              <Skeleton className="h-12 w-3/4 bg-slate-700" /> */}
              {/* Or a simple text loader */}
              <div className="text-slate-500 text-lg">Loading Data [▓▓▓▓▓    ]</div>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center py-10 px-6 bg-red-800/30 rounded-lg border border-red-700 shadow-lg">
            <p className="text-3xl text-red-400 font-bold">SYSTEM ERROR!</p>
            <p className="text-slate-300 mt-3 text-lg">{error}</p>
            <p className="text-slate-400 mt-2">Defaulting to simulation mode with test subjects...</p>
          </div>
        )}

        {!isLoading && (
          // The RatRaceGame component will be styled internally
          <RatRaceGame racers={displayRats} />
        )}
      </main>

      <footer className="mt-10 md:mt-16 text-center text-sm text-slate-500">
        <p>© {new Date().getFullYear()} thedeskrat Industries</p>
        <p>// Ready to RUMBLE_ //</p>
      </footer>
    </div>
  );
}