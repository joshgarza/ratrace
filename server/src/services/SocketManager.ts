// src/services/SocketManager.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'node:http';
import { Bet } from '../types/app'; // Import your Bet type

let io: SocketIOServer;
let bettingOpenState: { isOpen: boolean } = { isOpen: false }; // Shared state
let currentBetsRef: { current: Bet[] } = { current: [] }; // Shared state

export function initializeSocketIO(
  httpServer: HttpServer,
  sharedBettingState: { isOpen: boolean },
  sharedCurrentBets: { current: Bet[] }
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // TODO: Restrict in production
      methods: ['GET', 'POST'],
    },
  });

  bettingOpenState = sharedBettingState; // Link to shared state from index.ts
  currentBetsRef = sharedCurrentBets; // Link to shared state

  io.on('connection', (socket: Socket) => {
    console.log('SocketManager: Client connected', socket.id);
    socket.emit('betting_status', { isOpen: bettingOpenState.isOpen });

    socket.on('disconnect', () => {
      console.log('SocketManager: Client disconnected', socket.id);
    });
    // Add other specific socket event handlers here if needed
  });
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initializeSocketIO first.');
  }
  return io;
}

// Functions to emit events (can be called from routes or other services)
export function emitBettingStatus(isOpen: boolean, message: string) {
  getIO().emit('betting_status', { isOpen, message });
}

export function emitNewBet(userName: string, betInput: string) {
  getIO().emit('new_bet_placed', { userName, betInput });
}

export function emitRaceWinner(winningRatName: string, winners: string[]) {
  getIO().emit('race_winner_determined', { winningRatName, winners });
}
