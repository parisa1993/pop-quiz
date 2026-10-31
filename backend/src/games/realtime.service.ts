import { Injectable } from '@nestjs/common';
import { ServerEvents } from '@pop-quiz/shared';
import type { Server } from 'socket.io';
import { SessionsService } from './sessions.service.js';

export interface SocketData {
  isAdmin?: boolean;
  playerId?: string;
  sessionId?: string;
}

export const sessionRoom = (sessionId: string) => `session:${sessionId}`;

/** Pushes fresh snapshots to everyone in a session. Each gamer gets their own personal view. */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  constructor(private readonly sessions: SessionsService) {}

  attach(server: Server): void {
    this.server = server;
  }

  async broadcastSession(sessionId: string): Promise<void> {
    if (!this.server) return;
    const ctx = await this.sessions.loadContext(sessionId);
    if (!ctx) return;

    const sockets = await this.server.in(sessionRoom(sessionId)).fetchSockets();
    const connected = new Set(
      sockets.map((s) => (s.data as SocketData).playerId).filter((id): id is string => !!id),
    );
    let hostState: ReturnType<SessionsService['buildHostState']> | undefined;

    for (const socket of sockets) {
      const data = socket.data as SocketData;
      if (data.playerId) {
        socket.emit(
          ServerEvents.GameState,
          this.sessions.buildPlayerState(ctx, data.playerId, connected),
        );
      } else if (data.isAdmin) {
        hostState ??= this.sessions.buildHostState(ctx, connected);
        socket.emit(ServerEvents.HostState, hostState);
      }
    }
  }

  /** Tells every open game list to refresh (quiz enabled, lobby opened, game started…). */
  gamesChanged(): void {
    this.server?.emit(ServerEvents.GamesChanged);
  }
}
