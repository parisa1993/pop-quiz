import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Ack, ServerEvents } from '@pop-quiz/shared';
import type { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createTestDb, type TestDb } from '../src/testing/test-db.js';

export interface TestServer {
  app: NestExpressApplication;
  db: TestDb;
  url: string;
  close(): Promise<void>;
}

/** Boots the full Nest app on a random port with an isolated database. */
export async function startServer(): Promise<TestServer> {
  const db = await createTestDb();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(db.config)],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, db.config);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    db,
    url: `http://127.0.0.1:${port}`,
    async close() {
      await app.close();
      await db.close();
    },
  };
}

export function connect(url: string, token?: string): Promise<Socket> {
  const socket = io(url, {
    transports: ['websocket'],
    auth: token ? { token } : {},
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

export function emitAck<T = undefined>(
  socket: Socket,
  event: string,
  body: unknown,
): Promise<Ack<T>> {
  return socket.timeout(5000).emitWithAck(event, body) as Promise<Ack<T>>;
}

/** Records every snapshot a socket receives so tests can wait for a specific one. */
export class StateRecorder<T> {
  private readonly states: T[] = [];
  private waiters: { predicate: (s: T) => boolean; resolve: (s: T) => void }[] = [];

  constructor(socket: Socket, event: string = ServerEvents.GameState) {
    socket.on(event, (state: T) => {
      this.states.push(state);
      this.waiters = this.waiters.filter((w) => {
        if (!w.predicate(state)) return true;
        w.resolve(state);
        return false;
      });
    });
  }

  get latest(): T | undefined {
    return this.states.at(-1);
  }

  /** Resolves with the newest matching state, waiting for one if needed. */
  waitFor(predicate: (state: T) => boolean, timeoutMs = 5000): Promise<T> {
    const latest = this.latest;
    if (latest && predicate(latest)) return Promise.resolve(latest);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for state')), timeoutMs);
      this.waiters.push({
        predicate,
        resolve: (s) => {
          clearTimeout(timer);
          resolve(s);
        },
      });
    });
  }
}

/** A 1x1 transparent PNG. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
