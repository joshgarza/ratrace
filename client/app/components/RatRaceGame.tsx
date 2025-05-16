import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from "~/components/ui/button"; // Shadcn Button
// import { cn } from "~/lib/utils"; // If you need conditional classes

export interface RatData {
  id: string;
  name: string;
  color?: string; // Can be used for sprite tinting or fallback
}

interface Rat extends RatData {
  x: number;
  y: number;
  currentSpeed: number;
}

interface RatRaceGameProps {
  racers: RatData[];
}

// Game Configuration
const CANVAS_WIDTH = 800; // Intrinsic canvas drawing width
const CANVAS_HEIGHT_PER_RAT = 100; // Slightly adjusted space per rat
const RAT_SPRITE_DISPLAY_WIDTH = 60;
const RAT_SPRITE_DISPLAY_HEIGHT = 60;
const FINISH_LINE_X_OFFSET = RAT_SPRITE_DISPLAY_WIDTH;
const MAX_BASE_SPEED = .5; // Slightly faster for more excitement
const MIN_BASE_SPEED = .1;
const SPEED_VARIATION = 4;
const RAT_COLORS = ['#4ade80', '#fb923c', '#818cf8', '#facc15', '#a78bfa', '#f87171', '#2dd4bf', '#fbbf24']; // Brighter fallback colors

const RAT_SPRITE_SRC = '/rat_sprite.png'; // Ensure this sprite is in client/public/

const RatRaceGame: React.FC<RatRaceGameProps> = ({ racers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rats, setRats] = useState<Rat[]>([]);
  const [winner, setWinner] = useState<Rat | null>(null);
  const [raceActive, setRaceActive] = useState(false);
  const animationFrameId = useRef<number | null>(null);
  const [ratSprite, setRatSprite] = useState<HTMLImageElement | null>(null);

  const CANVAS_HEIGHT = Math.max(160, racers.length * CANVAS_HEIGHT_PER_RAT);
  const FINISH_LINE_X = CANVAS_WIDTH - FINISH_LINE_X_OFFSET;

  // Load sprite image
  useEffect(() => {
    const image = new Image();
    image.onload = () => setRatSprite(image);
    image.onerror = () => console.error("Error loading rat sprite from:", RAT_SPRITE_SRC);
    image.src = RAT_SPRITE_SRC;
  }, []);

  const drawRat = useCallback((ctx: CanvasRenderingContext2D, rat: Rat) => {
    if (ratSprite) {
      ctx.drawImage(ratSprite, rat.x, rat.y, RAT_SPRITE_DISPLAY_WIDTH, RAT_SPRITE_DISPLAY_HEIGHT);
    } else {
      ctx.fillStyle = rat.color || '#A0A0A0'; // Default fallback
      ctx.fillRect(rat.x, rat.y, RAT_SPRITE_DISPLAY_WIDTH, RAT_SPRITE_DISPLAY_HEIGHT);
    }
    ctx.fillStyle = '#E5E7EB'; // Light gray for text, good contrast on dark canvas
    ctx.font = 'bold 13px "Courier New", Monaco, monospace'; // Nerdy monospaced font
    ctx.textAlign = 'center';
    ctx.fillText(rat.name, rat.x + RAT_SPRITE_DISPLAY_WIDTH / 2, rat.y - 6);
  }, [ratSprite]);

  const drawTrack = useCallback((ctx: CanvasRenderingContext2D) => {
    // Finish line with a retro "digital" feel
    ctx.strokeStyle = '#00FF00'; // Bright green
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]); // Dashed line
    ctx.beginPath();
    ctx.moveTo(FINISH_LINE_X, 0);
    ctx.lineTo(FINISH_LINE_X, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Optional: Start line
    ctx.strokeStyle = '#FFA500'; // Orange
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10 + RAT_SPRITE_DISPLAY_WIDTH / 2, 0); // Approx start position
    ctx.lineTo(10 + RAT_SPRITE_DISPLAY_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();

  }, [CANVAS_HEIGHT, FINISH_LINE_X]);

  const initializeRats = useCallback(() => {
    // console.log("InitializeRats: Called.");
    const initialRats = racers.map((racer, index) => ({
      ...racer,
      x: 10,
      y: (index * CANVAS_HEIGHT_PER_RAT) + (CANVAS_HEIGHT_PER_RAT / 2) - (RAT_SPRITE_DISPLAY_HEIGHT / 2),
      color: racer.color || RAT_COLORS[index % RAT_COLORS.length],
      currentSpeed: MIN_BASE_SPEED + Math.random() * (MAX_BASE_SPEED - MIN_BASE_SPEED),
    }));
    setRats(initialRats);
    setWinner(null);
  }, [racers, CANVAS_HEIGHT_PER_RAT]);

  useEffect(() => {
    initializeRats();
  }, [initializeRats]);

  // Main Drawing Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawTrack(ctx);
    rats.forEach(rat => drawRat(ctx, rat));
    if (winner) {
      // Winner text on canvas (can be styled further)
      ctx.fillStyle = '#FFFF00'; // Bright Yellow
      ctx.font = 'bold 28px "Press Start 2P", "VT323", system-ui'; // Pixel font
      ctx.textAlign = 'center';
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      ctx.fillText(`WINNER: ${winner.name}!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.shadowBlur = 0; // Reset shadow
    }
  }, [rats, winner, drawTrack, drawRat, ratSprite, CANVAS_WIDTH, CANVAS_HEIGHT]); // Added ratSprite dependency

  // GameLoop
  const gameLoop = useCallback(() => {
    if (!raceActive || winner) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
      return;
    }
    setRats(prevRats =>
      prevRats.map(rat => {
        const speedFluctuation = (Math.random() - 0.5) * SPEED_VARIATION;
        const speedModifier = speedFluctuation < 0 ? 0 : speedFluctuation
        const moveAmount = rat.currentSpeed + speedModifier;
        let newX = rat.x + moveAmount;
        newX = Math.max(10, newX);
        if (newX > FINISH_LINE_X) newX = FINISH_LINE_X;
        return { ...rat, x: newX };
      })
    );
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [raceActive, winner, FINISH_LINE_X, setRats]); // Added setRats

  // Winner Detection Effect
  useEffect(() => {
    if (!winner) {
      for (const rat of rats) {
        if (rat.x >= FINISH_LINE_X - RAT_SPRITE_DISPLAY_WIDTH) {
          // console.log(`Winner Detection: ${rat.name} crossed.`);
          setWinner(rat);
          break;
        }
      }
    }
  }, [rats, winner, FINISH_LINE_X]);

  // Animation Start/Stop Effect
  useEffect(() => {
    if (raceActive && !winner) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = requestAnimationFrame(gameLoop);
    } else {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [raceActive, winner, gameLoop]);

  const handleStartRace = () => {
    // console.log("HandleStartRace: Called.");
    initializeRats();
    setRaceActive(true);
  };

  return (
    // Container for the game, styled with Tailwind
    <div className="w-full flex flex-col items-center p-3 sm:p-4 rounded-lg bg-slate-800 border-2 border-slate-700 shadow-xl">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        // Tailwind classes for the canvas element itself (optional, can conflict with fixed width/height)
        className="rounded-md border border-slate-600 shadow-inner_lg_custom" // Example custom shadow if defined
        // Use style for fixed size to ensure canvas drawing area is correct
        // style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }}
        // For responsive canvas that scales (more complex):
        // style={{ width: '100%', height: 'auto', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
      />
      <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
        {!raceActive && !winner && (
          <Button
            onClick={handleStartRace}
            variant="secondary" // shadcn variant
            size="lg"
            className="font-bold text-base sm:text-lg bg-green-500 hover:bg-green-600 text-slate-900 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full max-w-xs sm:w-auto"
          >
            {/* Consider an icon here too, e.g., from lucide-react */}
            🚀 Launch Rats!
          </Button>
        )}
        {raceActive && !winner && (
            <p className="text-lg sm:text-xl text-orange-400 animate-pulse font-['Source_Code_Pro',_monospace] p-3 rounded-md bg-slate-700/70 border border-orange-500/50">
                // Race_In_Progress... //
            </p>
        )}
        {winner && (
          <div className="text-center flex flex-col items-center gap-3 sm:gap-4">
            <p className="text-3xl sm:text-4xl font-bold text-yellow-400 animate-custom-bounce"> {/* Define custom-bounce in tailwind.config or globals */}
              🏆 {winner.name} Wins! 🏆
            </p>
            <Button
              onClick={handleStartRace}
              variant="outline"
              size="lg"
              className="font-bold text-base sm:text-lg border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-slate-100 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full max-w-xs sm:w-auto"
            >
              🏁 New Race?
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Shadcn UI styles for button and other elements will be applied through your global CSS and theme.
// const buttonStyle: React.CSSProperties = { ... }; // No longer needed if using shadcn Button with Tailwind
// const statusTextStyle: React.CSSProperties = { ... }; // No longer needed, use Tailwind classes

export default RatRaceGame;