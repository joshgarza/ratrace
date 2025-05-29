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
  isNewRat?: boolean;
  targetX: number; // Target X position at starting line
  targetY: number; // Target Y position
}

interface RatRaceGameProps {
  racers: RatData[];
}

// Game Configuration
const CANVAS_WIDTH = 800; // Intrinsic canvas drawing width
const MAX_CANVAS_HEIGHT = 500; // Max height of the canvas
const MIN_CANVAS_HEIGHT = 160; // Minimum height
const MAX_RATS_AT_NORMAL_HEIGHT = 5; // How many rats can fit without squeezing
const RAT_SPRITE_DISPLAY_WIDTH = 60;
const RAT_SPRITE_DISPLAY_HEIGHT = 60;
const FINISH_LINE_X_OFFSET = RAT_SPRITE_DISPLAY_WIDTH;
const MAX_BASE_SPEED = .5; // Slightly faster for more excitement
const MIN_BASE_SPEED = .1;
const SPEED_VARIATION = 4;
const RAT_ENTRY_SPEED = 0.5; // Entry speed (pixels per frame)
const RAT_STARTING_X = -100; // Starting position off-screen
const RAT_COLORS = ['#4ade80', '#fb923c', '#818cf8', '#facc15', '#a78bfa', '#f87171', '#2dd4bf', '#fbbf24']; // Brighter fallback colors

const RAT_SPRITE_SRC = '/rat_sprite.png'; // Ensure this sprite is in client/public/

const RatRaceGame: React.FC<RatRaceGameProps> = ({ racers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rats, setRats] = useState<Rat[]>([]);
  const [winner, setWinner] = useState<Rat | null>(null);
  const [raceActive, setRaceActive] = useState(false);
  const animationFrameId = useRef<number | null>(null);
  const [ratSprite, setRatSprite] = useState<HTMLImageElement | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousRacersRef = useRef<RatData[]>([]);
  // Use mutable refs for animation data to avoid state updates during animation
  const ratsRef = useRef<Rat[]>([]);

  // Calculate height per rat - will adjust based on number of rats
  const calculateHeightPerRat = useCallback((numRats: number) => {
    if (numRats <= MAX_RATS_AT_NORMAL_HEIGHT) {
      return 100; // Normal height when we have fewer rats
    }
    // Squeeze them in when there are more rats
    return Math.max(40, MAX_CANVAS_HEIGHT / numRats); // Minimum 40px per rat
  }, []);

  const CANVAS_HEIGHT = Math.min(
    MAX_CANVAS_HEIGHT,
    Math.max(MIN_CANVAS_HEIGHT, racers.length * calculateHeightPerRat(racers.length))
  );
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

  // Update the canvas with the current state
  const updateCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw everything
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawTrack(ctx);

    // Draw from the ref for smooth animation
    const currentRats = ratsRef.current;
    currentRats.forEach(rat => drawRat(ctx, rat));

    // Draw winner text if there is a winner
    if (winner) {
      ctx.fillStyle = '#FFFF00'; // Bright Yellow
      ctx.font = 'bold 28px "Press Start 2P", "VT323", system-ui'; // Pixel font
      ctx.textAlign = 'center';
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      ctx.fillText(`WINNER: ${winner.name}!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.shadowBlur = 0; // Reset shadow
    }
  }, [CANVAS_WIDTH, CANVAS_HEIGHT, drawTrack, drawRat, winner]);

  const initializeRats = useCallback(() => {
    // Calculate the height per rat based on the current number of racers
    const heightPerRat = calculateHeightPerRat(racers.length);

    // Check which rats are new by comparing with previous racers
    const prevRacerIds = previousRacersRef.current.map(r => r.id);
    const currentRacerIds = racers.map(r => r.id);

    // Identify new racers
    const newRacerIds = currentRacerIds.filter(id => !prevRacerIds.includes(id));

    // Update our reference
    previousRacersRef.current = [...racers];

    // Create rats
    const initialRats = racers.map((racer, index) => {
      const targetY = (index * heightPerRat) + (heightPerRat / 2) - (RAT_SPRITE_DISPLAY_HEIGHT / 2);
      const isNewRat = newRacerIds.includes(racer.id);
      const targetX = 10; // Starting line X position

      // Find existing rat to preserve position
      const existingRat = rats.find(r => r.id === racer.id);

      // If this is a new rat, set up entry animation
      if (isNewRat) {
        // Random starting Y position (within canvas bounds)
        const randomEntryY = Math.random() * CANVAS_HEIGHT * 0.7 + CANVAS_HEIGHT * 0.15;

        console.log(`Creating new rat: ${racer.name} at start position (${RAT_STARTING_X}, ${randomEntryY}), target: (${targetX}, ${targetY})`);

        return {
          ...racer,
          x: RAT_STARTING_X,
          y: randomEntryY,
          targetX,
          targetY,
          isNewRat: true,
          color: racer.color || RAT_COLORS[index % RAT_COLORS.length],
          currentSpeed: MIN_BASE_SPEED + Math.random() * (MAX_BASE_SPEED - MIN_BASE_SPEED),
        };
      }

      // For existing rats - keep their current position
      if (existingRat) {
        return {
          ...racer,
          x: existingRat.x,
          y: existingRat.y,
          targetX,
          targetY,
          isNewRat: false,
          color: racer.color || RAT_COLORS[index % RAT_COLORS.length],
          currentSpeed: MIN_BASE_SPEED + Math.random() * (MAX_BASE_SPEED - MIN_BASE_SPEED),
        };
      }

      // Default for any other case
      return {
        ...racer,
        x: targetX,
        y: targetY,
        targetX,
        targetY,
        isNewRat: false,
        color: racer.color || RAT_COLORS[index % RAT_COLORS.length],
        currentSpeed: MIN_BASE_SPEED + Math.random() * (MAX_BASE_SPEED - MIN_BASE_SPEED),
      };
    });

    // Update both the state and the ref
    setRats(initialRats);
    ratsRef.current = initialRats;
    setWinner(null);

    // If we have new rats, start entry animation
    if (newRacerIds.length > 0) {
      console.log(`Starting entry animation for ${newRacerIds.length} new rats`);
      setIsAnimating(true);
      startEntryAnimation();
    }
  }, [racers, calculateHeightPerRat, rats, CANVAS_HEIGHT]);

  // Separate function to start the entry animation
  const startEntryAnimation = useCallback(() => {
    console.log("Starting entry animation");

    // Make sure to cancel any existing animations
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    const animate = () => {
      let stillAnimating = false;

      // Update the refs directly without state updates
      const updatedRats = [...ratsRef.current].map(rat => {
        // Skip rats that are not new or have already reached their target
        if (!rat.isNewRat || (Math.abs(rat.x - rat.targetX) < 1 && Math.abs(rat.y - rat.targetY) < 1)) {
          if (rat.isNewRat && Math.abs(rat.x - rat.targetX) < 1) {
            // New rat has reached target, mark as no longer new
            return { ...rat, isNewRat: false, x: rat.targetX, y: rat.targetY };
          }
          return rat;
        }

        // This rat is still in entry animation
        stillAnimating = true;

        // Calculate direction vector
        const dx = rat.targetX - rat.x;
        const dy = rat.targetY - rat.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize and scale by speed
        const vx = (dx / distance) * RAT_ENTRY_SPEED;
        const vy = (dy / distance) * RAT_ENTRY_SPEED;

        // Add some wiggle for more natural movement
        const wiggleX = (Math.random() - 0.5) * 0.2;
        const wiggleY = (Math.random() - 0.5) * 0.2;

        // New position
        const newX = rat.x + vx + wiggleX;
        const newY = rat.y + vy + wiggleY;

        // Don't overshoot target
        if (distance < RAT_ENTRY_SPEED) {
          return { ...rat, x: rat.targetX, y: rat.targetY, isNewRat: false };
        }

        return {
          ...rat,
          x: newX,
          y: newY
        };
      });

      // Update the reference
      ratsRef.current = updatedRats;

      // Update the canvas
      updateCanvas();

      // Continue animation or stop
      if (stillAnimating) {
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        console.log("Entry animation complete");

        // Only update state once the animation is complete
        setRats(updatedRats);
        setIsAnimating(false);
        animationFrameId.current = null;
      }
    };

    // Start the animation
    animationFrameId.current = requestAnimationFrame(animate);
  }, [updateCanvas]);

  // Effect for race animation
  useEffect(() => {
    if (raceActive && !winner) {
      // Make sure to cancel any existing animations
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }

      const raceLoop = () => {
        // Update rat positions for race
        ratsRef.current = ratsRef.current.map(rat => {
          const speedFluctuation = (Math.random() - 0.5) * SPEED_VARIATION;
          const speedModifier = speedFluctuation < 0 ? 0 : speedFluctuation;
          const moveAmount = rat.currentSpeed + speedModifier;
          let newX = rat.x + moveAmount;
          newX = Math.max(10, newX);
          if (newX > FINISH_LINE_X) newX = FINISH_LINE_X;
          return { ...rat, x: newX };
        });

        // Check for winner
        let foundWinner = false;
        for (const rat of ratsRef.current) {
          if (rat.x >= FINISH_LINE_X - RAT_SPRITE_DISPLAY_WIDTH) {
            setWinner(rat);
            foundWinner = true;
            break;
          }
        }

        // Update the canvas
        updateCanvas();

        // Continue animation or stop
        if (!foundWinner) {
          animationFrameId.current = requestAnimationFrame(raceLoop);
        } else {
          // Update the state with final positions when we have a winner
          setRats([...ratsRef.current]);
        }
      };

      // Start the race loop
      animationFrameId.current = requestAnimationFrame(raceLoop);
    } else {
      // Cancel animation if race is not active or we have a winner
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [raceActive, winner, FINISH_LINE_X, updateCanvas]);

  // Initialize rats when racers change
  useEffect(() => {
    initializeRats();
  }, [initializeRats]);

  // Update the canvas when needed
  useEffect(() => {
    // Only update if we're not in an animation (to avoid conflicting with animation frames)
    if (!animationFrameId.current) {
      updateCanvas();
    }
  }, [rats, updateCanvas]);

  const handleStartRace = () => {
    // Don't start race if entry animation is still running
    if (isAnimating) return;

    initializeRats();
    setRaceActive(true);
  };

  const handleNewRace = () => {
    // Reset the winner state but keep rats at starting line
    setRaceActive(false);
    setWinner(null);
    // Initialize rats back at starting positions without starting race
    initializeRats();
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
        style={{
          maxHeight: `${MAX_CANVAS_HEIGHT}px`,
          width: '100%',
          height: 'auto',
          aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`
        }}
      />
      <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
        {!raceActive && !winner && (
          <Button
            onClick={handleStartRace}
            variant="secondary" // shadcn variant
            size="lg"
            disabled={isAnimating}
            className={`font-bold text-base sm:text-lg bg-green-500 hover:bg-green-600 text-slate-900 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full max-w-xs sm:w-auto ${
              isAnimating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isAnimating ? '🐀 Rats scurrying in...' : '🚀 Launch Rats!'}
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
              onClick={handleNewRace}
              variant="outline"
              size="lg"
              className="font-bold text-base sm:text-lg border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-slate-100 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full max-w-xs sm:w-auto"
            >
              🔄 Start New Race
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