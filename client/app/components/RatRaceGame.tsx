import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface RatData {
  id: string;
  name: string;
  color?: string; // Color can still be used for a fallback or a tint if desired
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
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT_PER_RAT = 80;
// These RAT_WIDTH and RAT_HEIGHT will now be the dimensions the sprite is drawn at
const RAT_SPRITE_DISPLAY_WIDTH = 40; // Adjust to your sprite's desired width
const RAT_SPRITE_DISPLAY_HEIGHT = 40; // Adjust to your sprite's desired height
const FINISH_LINE_X_OFFSET = RAT_SPRITE_DISPLAY_WIDTH;
const MAX_BASE_SPEED = 2.5;
const MIN_BASE_SPEED = 1;
const SPEED_VARIATION = 2.5;
const RAT_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#F1C40F', '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12']; // Fallback colors

const RAT_SPRITE_SRC = '/rat_sprite.png'; // Path to your sprite in the public folder

const RatRaceGame: React.FC<RatRaceGameProps> = ({ racers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rats, setRats] = useState<Rat[]>([]);
  const [winner, setWinner] = useState<Rat | null>(null);
  const [raceActive, setRaceActive] = useState(false);
  const animationFrameId = useRef<number | null>(null);
  const [ratSprite, setRatSprite] = useState<HTMLImageElement | null>(null); // State for the loaded sprite

  const CANVAS_HEIGHT = Math.max(200, racers.length * CANVAS_HEIGHT_PER_RAT);
  const FINISH_LINE_X = CANVAS_WIDTH - FINISH_LINE_X_OFFSET;

  // Effect to load the rat sprite image
  useEffect(() => {
    console.log("Loading rat sprite...");
    const image = new Image();
    image.onload = () => {
      console.log("Rat sprite loaded successfully!");
      setRatSprite(image);
    };
    image.onerror = () => {
      console.error("Error loading rat sprite from:", RAT_SPRITE_SRC);
    };
    image.src = RAT_SPRITE_SRC;
  }, []); // Runs once on component mount

  const drawRat = useCallback((ctx: CanvasRenderingContext2D, rat: Rat) => {
    if (ratSprite) {
      // Draw the loaded sprite
      // To flip the sprite if it's facing left and you want it to face right (towards finish line):
      // ctx.save();
      // ctx.scale(-1, 1);
      // ctx.drawImage(ratSprite, -rat.x - RAT_SPRITE_DISPLAY_WIDTH, rat.y, RAT_SPRITE_DISPLAY_WIDTH, RAT_SPRITE_DISPLAY_HEIGHT);
      // ctx.restore();
      // If sprite already faces right:
      ctx.drawImage(ratSprite, rat.x, rat.y, RAT_SPRITE_DISPLAY_WIDTH, RAT_SPRITE_DISPLAY_HEIGHT);
    } else {
      // Fallback drawing if sprite hasn't loaded yet
      ctx.fillStyle = rat.color || 'grey';
      ctx.fillRect(rat.x, rat.y, RAT_SPRITE_DISPLAY_WIDTH, RAT_SPRITE_DISPLAY_HEIGHT);
      console.warn("Rat sprite not loaded, drawing fallback for:", rat.name);
    }

    // Draw name (adjust position if needed based on sprite)
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center'; // Center name above/below sprite
    ctx.fillText(rat.name, rat.x + RAT_SPRITE_DISPLAY_WIDTH / 2, rat.y - 5);
  }, [ratSprite]); // Depends on the loaded sprite

  const drawTrack = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(FINISH_LINE_X, 0);
    ctx.lineTo(FINISH_LINE_X, CANVAS_HEIGHT);
    ctx.stroke();
  }, [CANVAS_HEIGHT, FINISH_LINE_X]);

  const initializeRats = useCallback(() => {
    console.log("InitializeRats: Called. Resetting rats and winner.");
    const initialRats = racers.map((racer, index) => ({
      ...racer,
      x: 10,
      y: (index * CANVAS_HEIGHT_PER_RAT) + (CANVAS_HEIGHT_PER_RAT / 2) - (RAT_SPRITE_DISPLAY_HEIGHT / 2), // Center sprite vertically
      color: racer.color || RAT_COLORS[index % RAT_COLORS.length], // Still useful for fallback
      currentSpeed: MIN_BASE_SPEED,
    }));
    setRats(initialRats);
    setWinner(null);
  }, [racers, CANVAS_HEIGHT_PER_RAT]);

  useEffect(() => {
    console.log("InitializeRats Effect: Running (mount/initializeRats identity change).");
    initializeRats();
  }, [initializeRats]);

  // Main Drawing Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Only attempt to draw if the sprite is loaded, or handle fallback drawing inside drawRat
    // The `drawRat` function itself now handles the fallback if `ratSprite` is null.
    // console.log(`Drawing Effect: Clearing canvas. Rats count: ${rats.length}, Winner: ${winner?.name || String(winner)}`);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawTrack(ctx);
    rats.forEach(rat => drawRat(ctx, rat));

    if (winner) {
      ctx.fillStyle = 'gold';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${winner.name} Wins!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  }, [rats, winner, drawTrack, drawRat, CANVAS_WIDTH, CANVAS_HEIGHT, ratSprite]); // Added ratSprite as a dependency

  // GameLoop
  const gameLoop = useCallback(() => {
    // console.log(`GameLoop Tick: Checking conditions - raceActive=${raceActive}, winner=${winner?.name || String(winner)}`);
    if (!raceActive || winner) {
      // console.log("GameLoop Tick: Halting loop. raceActive is false or winner exists.");
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      return;
    }

    setRats(prevRats => {
      return prevRats.map(rat => {
        const speedFluctuation = (Math.random() - 0.5) * SPEED_VARIATION;
        const speedModifier = speedFluctuation < 0 ? 0: speedFluctuation
        const moveAmount = rat.currentSpeed + speedModifier;
        let newX = rat.x + moveAmount;
        newX = Math.max(10, newX);
        if (newX > FINISH_LINE_X - RAT_SPRITE_DISPLAY_WIDTH) {
          newX = FINISH_LINE_X - RAT_SPRITE_DISPLAY_WIDTH;
        }
        return { ...rat, x: newX };
      });
    });

    animationFrameId.current = requestAnimationFrame(gameLoop);
    // console.log("GameLoop Tick: Re-queued self via requestAnimationFrame.");
  }, [raceActive, winner, FINISH_LINE_X, setRats]);

  // Winner Detection Effect
  useEffect(() => {
    // console.log(`Winner Detection Effect: Checking for winner. Current winner: ${winner?.name || String(winner)}`);
    if (!winner) {
      for (const rat of rats) {
        if (rat.x >= FINISH_LINE_X - RAT_SPRITE_DISPLAY_WIDTH) {
          console.log(`Winner Detection Effect: Rat ${rat.name} at x=${rat.x.toFixed(2)} crossed FINISH_LINE_X (${FINISH_LINE_X}). SETTING WINNER.`);
          setWinner(rat);
          break;
        }
      }
    }
  }, [rats, winner, FINISH_LINE_X]);

  // Animation Start/Stop Effect
  useEffect(() => {
    // console.log(`--- Animation Start/Stop Effect RUNS ---`);
    // console.log(`Values: raceActive=${raceActive}, winner=${winner?.name || String(winner)}`);
    if (raceActive && !winner) {
      // console.log("Animation Start/Stop Effect: Initial KICK-OFF of gameLoop via requestAnimationFrame.");
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      animationFrameId.current = requestAnimationFrame(gameLoop);
    } else {
      if (animationFrameId.current) {
        // console.log("Animation Start/Stop Effect: race not active or winner found. Cancelling animation frame.");
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }
    return () => {
      // console.log(`--- Animation Start/Stop Effect CLEANUP ---`);
      if (animationFrameId.current) {
        // console.log("Animation Start/Stop Effect Cleanup: Cancelling animation frame.");
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [raceActive, winner, gameLoop]);

  const handleStartRace = () => {
    console.log("HandleStartRace: Called.");
    initializeRats();
    console.log("HandleStartRace: Setting raceActive to true.");
    setRaceActive(true);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ border: '1px solid #555', backgroundColor: '#333', margin: '20px auto', display: 'block' }}
      />
      <div style={{ textAlign: 'center' }}>
        {!raceActive && !winner && (
          <button onClick={handleStartRace} style={buttonStyle}>
            Start Race
          </button>
        )}
        {raceActive && !winner && <p style={statusTextStyle}>Race in progress...</p>}
        {winner && (
          <>
            <p style={{ ...statusTextStyle, fontSize: '24px', color: '#1DB954' }}>
              🏆 {winner.name} wins the race! 🏆
            </p>
            <button onClick={handleStartRace} style={buttonStyle}>
              Race Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: '16px',
  cursor: 'pointer',
  backgroundColor: '#772CE8',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  margin: '10px',
};

const statusTextStyle: React.CSSProperties = {
  color: 'white',
  fontSize: '18px',
  margin: '10px',
};

export default RatRaceGame;