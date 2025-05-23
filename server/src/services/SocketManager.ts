// src/services/SocketManager.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'node:http';
import { RaceParticipant } from '../types/app'; // Updated to RaceParticipant

let io: SocketIOServer;
let raceStateRef: { isOpen: boolean } = { isOpen: false }; // Shared state
let participantsRef: { current: RaceParticipant[] } = { current: [] }; // Shared state

export function initializeSocketIO(
  httpServer: HttpServer,
  sharedRaceState: { isOpen: boolean },
  sharedParticipants: { current: RaceParticipant[] }
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // TODO: Restrict in production
      methods: ['GET', 'POST'],
    },
  });

  raceStateRef = sharedRaceState; // Link to shared state from index.ts
  participantsRef = sharedParticipants; // Link to shared state

  io.on('connection', (socket: Socket) => {
    console.log('SocketManager: Client connected', socket.id);
    socket.emit('registration_status', { isOpen: raceStateRef.isOpen });

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
export function emitRegistrationStatus(isOpen: boolean, message: string) {
  getIO().emit('registration_status', { isOpen, message });
}

export function emitNewParticipant(userName: string) {
  getIO().emit('new_participant', { userName });
}

export function emitRaceWinner(winningRatName: string, participants: string[]) {
  getIO().emit('race_winner_determined', { winningRatName, participants });
}
