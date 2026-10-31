import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { GameListItem, JoinGameRequest, JoinGameResponse } from '@pop-quiz/shared';
import { RealtimeService } from './realtime.service.js';
import { SessionsService } from './sessions.service.js';

/** Public endpoints used by gamers. */
@Controller('games')
export class GamesController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get()
  list(): Promise<GameListItem[]> {
    return this.sessions.listGames();
  }

  @Post(':quizId/join')
  @HttpCode(200)
  async join(
    @Param('quizId') quizId: string,
    @Body() body: JoinGameRequest,
  ): Promise<JoinGameResponse> {
    if (typeof body?.playerId !== 'string' || !body.playerId) {
      throw new BadRequestException('Missing player');
    }
    const sessionId = await this.sessions.joinQuiz(quizId, body.playerId);
    this.realtime.gamesChanged();
    return { sessionId };
  }
}
