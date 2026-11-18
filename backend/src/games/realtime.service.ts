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
  private readonly running = new Map<string, Promise<void>>();
  private readonly pending = new Set<string>();

  constructor(private readonly sessions: SessionsService) {}

  attach(server: Server): void {
    this.server = server;
  }

  /**
   * Sends fresh snapshots. When 40 players answer at once, calls that arrive while a broadcast is
   * running are combined into one follow-up broadcast of the latest state, so the server doesn't
   * send 40 near-identical rounds. The returned promise resolves once the newest state was sent.
   */
  broadcastSession(sessionId: string): Promise<void> {
    const inFlight = this.running.get(sessionId);
    if (inFlight) {
      this.pending.add(sessionId);
      return inFlight;
    }
    const run = (async () => {
      do {
        this.pending.delete(sessionId);
        await this.sendSnapshots(sessionId);
      } while (this.pending.has(sessionId));
    })().finally(() => this.running.delete(sessionId));
    this.running.set(sessionId, run);
    return run;
  }

  private async sendSnapshots(sessionId: string): Promise<void> {
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
