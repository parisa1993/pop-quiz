import { HttpException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ClientEvents } from '@pop-quiz/shared';
import type {
  Ack,
  AdminSessionRequest,
  PlayerAnswerRequest,
  PlayerJoinRequest,
} from '@pop-quiz/shared';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { RealtimeService, sessionRoom, type SocketData } from './realtime.service.js';
import { SessionsService } from './sessions.service.js';

type GameSocket = Socket & { data: SocketData };

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Turns thrown errors into a friendly `{ ok: false, error }` acknowledgement. */
export async function toAck<T = undefined>(work: () => Promise<T>): Promise<Ack<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const message =
      error instanceof HttpException ? error.message : 'Something went wrong, please try again';
    if (!(error instanceof HttpException)) console.error(error);
    return { ok: false, error: message };
  }
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly sessions: SessionsService,
    private readonly realtime: RealtimeService,
    private readonly auth: AuthService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
  }

  async handleConnection(client: GameSocket): Promise<void> {
    const token = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    client.data.isAdmin = await this.auth.isAdminToken(token);
  }

  async handleDisconnect(client: GameSocket): Promise<void> {
    if (client.data.sessionId) await this.realtime.broadcastSession(client.data.sessionId);
  }

  @SubscribeMessage(ClientEvents.PlayerJoin)
  join(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: PlayerJoinRequest,
  ): Promise<Ack> {
    return toAck(async () => {
      if (!isString(body?.sessionId) || !isString(body?.playerId)) {
        throw new HttpException('Missing game or player', 400);
      }
      if (!(await this.sessions.isPlayerInSession(body.sessionId, body.playerId))) {
        throw new HttpException('Pick the game from the list to join', 404);
      }
      await this.switchRoom(client, body.sessionId);
      client.data.playerId = body.playerId;
      await this.realtime.broadcastSession(body.sessionId);
      this.realtime.gamesChanged();
      return undefined;
    });
  }

  @SubscribeMessage(ClientEvents.PlayerAnswer)
  answer(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: PlayerAnswerRequest,
  ): Promise<Ack> {
    return toAck(async () => {
      const { playerId, sessionId } = client.data;
      if (!playerId || !sessionId || sessionId !== body?.sessionId) {
        throw new HttpException('Join the game first', 409);
      }
      if (!isString(body.questionId)) throw new HttpException('Missing question', 400);
      await this.sessions.submitAnswer(sessionId, playerId, body.questionId, body.payload);
      await this.realtime.broadcastSession(sessionId);
      return undefined;
    });
  }

  @SubscribeMessage(ClientEvents.AdminWatch)
  watch(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: AdminSessionRequest,
  ): Promise<Ack> {
    return this.asAdmin(client, body, async (sessionId) => {
      if (!(await this.sessions.loadContext(sessionId)))
        throw new HttpException('Game not found', 404);
      client.data.playerId = undefined;
      await this.switchRoom(client, sessionId);
    });
  }

  @SubscribeMessage(ClientEvents.AdminStart)
  start(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: AdminSessionRequest,
  ): Promise<Ack> {
    return this.asAdmin(client, body, (id) => this.sessions.start(id), true);
  }

  @SubscribeMessage(ClientEvents.AdminNext)
  next(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: AdminSessionRequest,
  ): Promise<Ack> {
    return this.asAdmin(client, body, (id) => this.sessions.move(id, 1));
  }

  @SubscribeMessage(ClientEvents.AdminPrev)
  prev(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: AdminSessionRequest,
  ): Promise<Ack> {
    return this.asAdmin(client, body, (id) => this.sessions.move(id, -1));
  }

  @SubscribeMessage(ClientEvents.AdminReveal)
  reveal(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: AdminSessionRequest,
  ): Promise<Ack> {
    return this.asAdmin(client, body, (id) => this.sessions.reveal(id));
  }

  @SubscribeMessage(ClientEvents.AdminFinish)
  finish(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() body: AdminSessionRequest,
  ): Promise<Ack> {
    return this.asAdmin(client, body, (id) => this.sessions.finish(id), true);
  }

  private asAdmin(
    client: GameSocket,
    body: AdminSessionRequest,
    action: (sessionId: string) => Promise<void>,
    listChanged = false,
  ): Promise<Ack> {
    return toAck(async () => {
      if (!client.data.isAdmin) throw new HttpException('Admin login required', 401);
      if (!isString(body?.sessionId)) throw new HttpException('Missing game', 400);
      await action(body.sessionId);
      await this.realtime.broadcastSession(body.sessionId);
      if (listChanged) this.realtime.gamesChanged();
      return undefined;
    });
  }

  private async switchRoom(client: GameSocket, sessionId: string): Promise<void> {
    const previous = client.data.sessionId;
    if (previous && previous !== sessionId) {
      await client.leave(sessionRoom(previous));
      client.data.sessionId = undefined;
      await this.realtime.broadcastSession(previous);
    }
    await client.join(sessionRoom(sessionId));
    client.data.sessionId = sessionId;
  }
}
