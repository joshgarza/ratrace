import RatRaceGame, { type RatData } from "~/components/RatRaceGame"; // Ensure this path is correct
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import AdminControls from "~/components/AdminControls"; // Import the AdminControls component
// Shadcn UI components you might want for this page (e.g., a loading spinner)
// import { Skeleton } from "~/components/ui/skeleton"; // Example

// Define the structure of a participant from your API
interface RaceParticipant {
  userId: string;
  userName: string;
  userLogin: string;
  registeredAt: string;
  color: string;
}

interface ApiParticipantsResponse {
  isRegistrationOpen: boolean;
  participants: RaceParticipant[];
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
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const socketRef = useRef<Socket | null>(null);

  // Connect to socket.io
  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io("http://localhost:3000");

    // Handle socket events
    socketRef.current.on("connect", () => {
      console.log("Socket.IO connected!");
    });

    socketRef.current.on("registration_status", (data: { isOpen: boolean, message: string }) => {
      console.log("Registration status update:", data);
      setIsRegistrationOpen(data.isOpen);
      setStatusMessage(data.message);
    });

    socketRef.current.on("new_participant", (data: { userName: string }) => {
      console.log("New participant joined:", data.userName);
      // Fetch latest participants
      fetchParticipants();
    });

    socketRef.current.on("participants_reset", (data: { message: string }) => {
      console.log("Participants reset:", data.message);
      // Clear rats list
      setRats([]);
      setStatusMessage("All rats have been reset");

      // Re-fetch participants to ensure we have the latest state
      fetchParticipants();
    });

    socketRef.current.on("race_winner_determined", (data: { winningRatName: string, participants: string[] }) => {
      console.log("Race winner:", data.winningRatName);
      // Handle race winner announcement if needed
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Function to fetch participants
  const fetchParticipants = async () => {
    try {
      // Fetch participants from the API
      const response = await fetch("http://localhost:3000/api/participants", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch participants: ${response.status}`);
      }

      const data: ApiParticipantsResponse = await response.json();
      console.log("Participants data received:", data);

      // Set registration status
      setIsRegistrationOpen(data.isRegistrationOpen);

      // Map participants to rat data
      const mappedRats: RatData[] = data.participants.map((participant) => ({
        id: participant.userId,
        name: participant.userName,
        color: participant.color
      }));

      // Set rats to empty array if no participants found
      setRats(mappedRats.length > 0 ? mappedRats : []);
    } catch (err: any) {
      console.error("Error fetching participants:", err);
      setError(err.message || "An unknown error occurred.");
    }
  };

  useEffect(() => {
    // Check URL parameters
    const authSuccess = searchParams.get("auth") === "success";
    const authError = searchParams.get("error") === "auth_failed";

    if (authSuccess) {
      console.log("Authentication successful!");
    }

    if (authError) {
      setError("Authentication failed. Please try again.");
    }

    async function checkAuthAndFetchParticipants() {
      setIsLoading(true);
      setError(null);
      try {
        // First check if we're authenticated
        console.log("Checking authentication status...");
        const authCheck = await fetch("http://localhost:3000/api/protected", {
          credentials: "include",
        });

        if (!authCheck.ok) {
          if (authCheck.status === 401) {
            console.log("Not authenticated, redirecting to reauth endpoint");
            // Direct browser navigation to server reauth endpoint
            window.location.href = "http://localhost:3000/auth/reauth";
            return;
          }
          throw new Error(`Auth check failed: ${authCheck.status}`);
        }

        console.log("Authentication successful, fetching participants");
        // Now fetch participants instead of subscribers
        await fetchParticipants();
      } catch (err: any) {
        console.error("Error:", err);
        setError(err.message || "An unknown error occurred.");
        setRats([]); // Set empty array instead of fallback rats
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthAndFetchParticipants();
  }, [searchParams]);

  // Determine which rats to display based on loading/error state
  const displayRats = isLoading ? [] : rats;

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
          {statusMessage || (isRegistrationOpen ? "Registration OPEN! Type !register in chat" : "Registration closed")}
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
          <>
            {displayRats.length === 0 && !error ? (
              <div className="text-center py-10 px-6 bg-slate-800/50 rounded-lg border border-slate-700 shadow-lg">
                <p className="text-2xl text-slate-300 font-bold">No Rats Registered</p>
                <p className="text-slate-400 mt-2">Open registration and have participants register to join the race!</p>
              </div>
            ) : (
              /* The RatRaceGame component will be styled internally */
              <RatRaceGame racers={displayRats} />
            )}

            {/* Add the admin controls panel */}
            <div className="mt-8">
              <AdminControls isRegistrationOpen={isRegistrationOpen} />
            </div>
          </>
        )}
      </main>

      <footer className="mt-10 md:mt-16 text-center text-sm text-slate-500">
        <p>© {new Date().getFullYear()} thedeskrat Industries</p>
        <p>// Ready to RUMBLE_ //</p>
      </footer>
    </div>
  );
}