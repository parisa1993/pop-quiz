import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  AdminLoginResponse,
  GameListItem,
  JoinGameResponse,
  PlayerDto,
  Question,
  QuestionInput,
  QuizDetail,
  QuizInput,
  QuizSummary,
  SessionResults,
  SessionSummary,
  UploadResponse,
} from '@pop-quiz/shared';
import { firstValueFrom } from 'rxjs';

/** Typed wrapper around every backend endpoint. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ----- Admin -----
  async adminLogin(password: string): Promise<string> {
    const res = await firstValueFrom(this.http.post<AdminLoginResponse>('/api/admin/login', { password }));
    return res.token;
  }

  listQuizzes(): Promise<QuizSummary[]> {
    return firstValueFrom(this.http.get<QuizSummary[]>('/api/admin/quizzes'));
  }

  getQuiz(id: string): Promise<QuizDetail> {
    return firstValueFrom(this.http.get<QuizDetail>(`/api/admin/quizzes/${id}`));
  }

  createQuiz(input: QuizInput): Promise<QuizDetail> {
    return firstValueFrom(this.http.post<QuizDetail>('/api/admin/quizzes', input));
  }

  updateQuiz(id: string, input: Partial<QuizInput>): Promise<QuizDetail> {
    return firstValueFrom(this.http.patch<QuizDetail>(`/api/admin/quizzes/${id}`, input));
  }

  deleteQuiz(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/quizzes/${id}`));
  }

  createQuestion(quizId: string, input: QuestionInput): Promise<Question> {
    return firstValueFrom(this.http.post<Question>(`/api/admin/quizzes/${quizId}/questions`, input));
  }

  updateQuestion(id: string, input: QuestionInput): Promise<Question> {
    return firstValueFrom(this.http.patch<Question>(`/api/admin/questions/${id}`, input));
  }

  deleteQuestion(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/questions/${id}`));
  }

  reorderQuestions(quizId: string, ids: string[]): Promise<Question[]> {
    return firstValueFrom(this.http.put<Question[]>(`/api/admin/quizzes/${quizId}/questions/order`, { ids }));
  }

  async uploadImage(file: Blob, filename: string): Promise<string> {
    const form = new FormData();
    form.append('file', file, filename);
    const res = await firstValueFrom(this.http.post<UploadResponse>('/api/admin/uploads', form));
    return res.url;
  }

  openSession(quizId: string): Promise<SessionSummary> {
    return firstValueFrom(this.http.post<SessionSummary>(`/api/admin/quizzes/${quizId}/sessions`, {}));
  }

  listSessions(quizId: string): Promise<SessionSummary[]> {
    return firstValueFrom(this.http.get<SessionSummary[]>(`/api/admin/quizzes/${quizId}/sessions`));
  }

  getResults(sessionId: string): Promise<SessionResults> {
    return firstValueFrom(this.http.get<SessionResults>(`/api/admin/sessions/${sessionId}/results`));
  }

  // ----- Gamers -----
  createPlayer(username: string): Promise<PlayerDto> {
    return firstValueFrom(this.http.post<PlayerDto>('/api/players', { username }));
  }

  getPlayer(id: string): Promise<PlayerDto> {
    return firstValueFrom(this.http.get<PlayerDto>(`/api/players/${id}`));
  }

  listGames(): Promise<GameListItem[]> {
    return firstValueFrom(this.http.get<GameListItem[]>('/api/games'));
  }

  async joinGame(quizId: string, playerId: string): Promise<string> {
    const res = await firstValueFrom(this.http.post<JoinGameResponse>(`/api/games/${quizId}/join`, { playerId }));
    return res.sessionId;
  }
}
