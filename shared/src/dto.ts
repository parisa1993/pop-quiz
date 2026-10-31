import { Question, QuestionInput } from './question-types.js';
import { RankedPlayer } from './scoring.js';

export type SessionStatus = 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';

export const ADMIN_PASSWORD_DEFAULT = '9999';
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 20;

export interface AdminLoginRequest {
  password: string;
}

export interface AdminLoginResponse {
  token: string;
}

export interface QuizInput {
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  enabled?: boolean;
}

export interface ActiveSessionInfo {
  id: string;
  status: SessionStatus;
  playerCount: number;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  enabled: boolean;
  questionCount: number;
  /** Distinct players who joined any session of this quiz. */
  playerCount: number;
  sessionCount: number;
  activeSession: ActiveSessionInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizDetail extends QuizSummary {
  questions: Question[];
}

export type { QuestionInput };

export interface ReorderQuestionsRequest {
  ids: string[];
}

export interface UploadResponse {
  url: string;
}

export interface PlayerDto {
  id: string;
  username: string;
}

export interface CreatePlayerRequest {
  username: string;
}

/** A quiz gamers can pick from the list. */
export interface GameListItem {
  quizId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  questionCount: number;
  session: ActiveSessionInfo | null;
}

export interface JoinGameRequest {
  playerId: string;
}

export interface JoinGameResponse {
  sessionId: string;
}

export interface SessionSummary {
  id: string;
  quizId: string;
  status: SessionStatus;
  playerCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ResultAnswer {
  playerId: string;
  questionId: string;
  answerText: string;
  isCorrect: boolean;
  points: number;
}

export interface ResultQuestion {
  id: string;
  order: number;
  text: string;
  type: Question['type'];
  points: number;
  correctAnswer: string;
}

export interface SessionResults {
  session: SessionSummary & { quizTitle: string };
  leaderboard: RankedPlayer[];
  questions: ResultQuestion[];
  answers: ResultAnswer[];
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
}
