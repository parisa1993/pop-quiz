import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { Ack } from '@pop-quiz/shared';
import { Observable } from 'rxjs';
import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';

export type SocketFactory = (options: Partial<ManagerOptions & SocketOptions>) => Socket;

export const SOCKET_FACTORY = new InjectionToken<SocketFactory>('SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (options) => io(options),
});

/** One shared Socket.IO connection. Reconnects automatically; pages re-join on `connected`. */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly factory = inject(SOCKET_FACTORY);
  private socket: Socket | null = null;
  private token: string | undefined;
  readonly connected = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  /** Connects (or reuses the connection). Pass the admin token to unlock host controls. */
  connect(token?: string): Socket {
    if (this.socket && this.token === token) return this.socket;
    this.disconnect();
    this.token = token;
    const socket = this.factory({
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 3000,
    });
    socket.on('connect', () => this.connected.set(true));
    socket.on('disconnect', () => this.connected.set(false));
    this.socket = socket;
    return socket;
  }

  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const socket = this.socket ?? this.connect();
      const handler = (value: T) => subscriber.next(value);
      socket.on(event, handler);
      return () => socket.off(event, handler);
    });
  }

  async emit<T = undefined>(event: string, body: unknown): Promise<Ack<T>> {
    const socket = this.socket ?? this.connect();
    try {
      return (await socket.timeout(8000).emitWithAck(event, body)) as Ack<T>;
    } catch {
      return { ok: false, error: 'Connection hiccup, please try again' };
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.token = undefined;
    this.connected.set(false);
  }
}
