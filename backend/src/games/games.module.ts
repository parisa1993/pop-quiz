import { Module } from '@nestjs/common';
import { AdminSessionsController } from './admin-sessions.controller.js';
import { GameGateway } from './game.gateway.js';
import { GamesController } from './games.controller.js';
import { RealtimeService } from './realtime.service.js';
import { ResultsService } from './results.service.js';
import { SessionsService } from './sessions.service.js';

@Module({
  controllers: [GamesController, AdminSessionsController],
  providers: [SessionsService, ResultsService, RealtimeService, GameGateway],
  exports: [SessionsService, RealtimeService],
})
export class GamesModule {}
