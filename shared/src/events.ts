import { SessionStatus } from './dto.js';
import { AnswerPayload, PublicQuestion, Question } from './question-types.js';
import { DistributionBucket, GradeResult, RankedPlayer } from './scoring.js';

/** Events the browser sends to the server. */
export const ClientEvents = {
  PlayerJoin: 'player:join',
  PlayerAnswer: 'player:answer',
  AdminWatch: 'admin:watch',
  AdminStart: 'admin:start',
  AdminNext: 'admin:next',
  AdminPrev: 'admin:prev',
  AdminReveal: 'admin:reveal',
  AdminFinish: 'admin:finish',
} as const;

/** Events the server pushes to browsers. */
export const ServerEvents = {
  /** Personal game snapshot for one gamer. */
  GameState: 'game:state',
  /** Full snapshot (with answers and live progress) for the host. */
  HostState: 'host:state',
  /** Something about the list of playable games changed. */
  GamesChanged: 'games:changed',
} as const;

export interface PlayerJoinRequest {
  sessionId: string;
  playerId: string;
}

export interface PlayerAnswerRequest {
  sessionId: string;
  questionId: string;
  payload: AnswerPayload;
}

export interface AdminSessionRequest {
  sessionId: string;
}

export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface LobbyPlayer {
  id: string;
  username: string;
  connected: boolean;
}

export interface FinalResult {
  rank: number;
  score: number;
  playerCount: number;
  podium: RankedPlayer[];
}

export interface PlayerGameState {
  sessionId: string;
  quizTitle: string;
  status: SessionStatus;
  /** 0-based index of the unlocked question. */
  currentIndex: number;
  totalQuestions: number;
  players: LobbyPlayer[];
  question: PublicQuestion | null;
  revealed: boolean;
  myAnswer: AnswerPayload | null;
  /** Only present after the host reveals the answer. */
  myResult: GradeResult | null;
  correctAnswerText: string | null;
  /** Points from questions whose answers have been revealed. */
  myScore: number;
  final: FinalResult | null;
}

export interface HostPlayer extends LobbyPlayer {
  score: number;
  answeredCurrent: boolean;
}

export interface HostGameState {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  status: SessionStatus;
  currentIndex: number;
  totalQuestions: number;
  question: Question | null;
  correctAnswerText: string | null;
  revealed: boolean;
  players: HostPlayer[];
  answeredCount: number;
  distribution: DistributionBucket[];
  leaderboard: RankedPlayer[];
}
