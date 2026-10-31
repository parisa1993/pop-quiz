import { Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import type { SessionResults, SessionSummary } from '@pop-quiz/shared';
import { AdminGuard } from '../auth/admin.guard.js';
import { RealtimeService } from './realtime.service.js';
import { ResultsService } from './results.service.js';
import { SessionsService } from './sessions.service.js';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminSessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly results: ResultsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Opens (or reuses) the lobby so the admin can host the quiz. */
  @Post('quizzes/:quizId/sessions')
  async open(@Param('quizId') quizId: string): Promise<SessionSummary> {
    const session = await this.sessions.openSession(quizId);
    this.realtime.gamesChanged();
    const info = await this.sessions.activeSessionInfo(quizId);
    return this.sessions.toSummary(session, info?.playerCount ?? 0);
  }

  @Get('quizzes/:quizId/sessions')
  list(@Param('quizId') quizId: string): Promise<SessionSummary[]> {
    return this.sessions.listSessions(quizId);
  }

  @Get('sessions/:sessionId')
  async get(@Param('sessionId') sessionId: string): Promise<SessionSummary> {
    const ctx = await this.sessions.loadContext(sessionId);
    if (!ctx) throw new NotFoundException('Game not found');
    return this.sessions.toSummary(ctx.session, ctx.players.length);
  }

  @Get('sessions/:sessionId/results')
  getResults(@Param('sessionId') sessionId: string): Promise<SessionResults> {
    return this.results.getResults(sessionId);
  }
}
