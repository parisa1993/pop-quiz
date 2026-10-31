import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { PlayerDto } from '@pop-quiz/shared';
import { ApiService } from './api.service';
import { storage, STORAGE_KEYS } from './storage';

/**
 * Remembers the gamer's name and current game in localStorage,
 * so closing the browser and coming back drops them straight into the game.
 */
@Injectable({ providedIn: 'root' })
export class PlayerSessionService {
  private readonly api = inject(ApiService);
  readonly player = signal<PlayerDto | null>(storage.get<PlayerDto>(STORAGE_KEYS.player));
  readonly sessionId = signal<string | null>(storage.get<string>(STORAGE_KEYS.sessionId));

  async register(username: string): Promise<PlayerDto> {
    const player = await this.api.createPlayer(username);
    this.setPlayer(player);
    return player;
  }

  /** Checks the stored player still exists on the server; forgets it if not. */
  async verify(): Promise<boolean> {
    const player = this.player();
    if (!player) return false;
    try {
      this.setPlayer(await this.api.getPlayer(player.id));
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) this.forget();
      return error instanceof HttpErrorResponse && error.status !== 404;
    }
  }

  async join(quizId: string): Promise<string> {
    const player = this.player();
    if (!player) throw new Error('Pick a name first');
    const sessionId = await this.api.joinGame(quizId, player.id);
    this.setSession(sessionId);
    return sessionId;
  }

  setSession(sessionId: string | null): void {
    this.sessionId.set(sessionId);
    storage.set(STORAGE_KEYS.sessionId, sessionId);
  }

  forget(): void {
    this.setPlayer(null);
    this.setSession(null);
  }

  private setPlayer(player: PlayerDto | null): void {
    this.player.set(player);
    storage.set(STORAGE_KEYS.player, player);
  }
}
