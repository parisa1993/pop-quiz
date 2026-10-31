export const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'IMAGE_CHOICE',
  'TYPE_ANSWER',
  'ORDERING',
  'NUMBER_GUESS',
  'POLL',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && (QUESTION_TYPES as readonly string[]).includes(value);
}

/** A selectable answer option. `imageUrl` is required for IMAGE_CHOICE, optional elsewhere. */
export interface ChoiceOption {
  id: string;
  text: string;
  imageUrl?: string | null;
}

export interface OrderItem {
  id: string;
  text: string;
}

export interface SingleChoiceConfig {
  options: ChoiceOption[];
  correctOptionId: string;
}

export interface MultipleChoiceConfig {
  options: ChoiceOption[];
  correctOptionIds: string[];
}

export interface TrueFalseConfig {
  correct: boolean;
}

export interface ImageChoiceConfig {
  options: ChoiceOption[];
  correctOptionId: string;
}

export interface TypeAnswerConfig {
  acceptedAnswers: string[];
}

/** Items are stored in the correct order. */
export interface OrderingConfig {
  items: OrderItem[];
}

export interface NumberGuessConfig {
  correct: number;
  tolerance: number;
  unit?: string | null;
}

export interface PollConfig {
  options: ChoiceOption[];
}

export interface QuestionConfigMap {
  SINGLE_CHOICE: SingleChoiceConfig;
  MULTIPLE_CHOICE: MultipleChoiceConfig;
  TRUE_FALSE: TrueFalseConfig;
  IMAGE_CHOICE: ImageChoiceConfig;
  TYPE_ANSWER: TypeAnswerConfig;
  ORDERING: OrderingConfig;
  NUMBER_GUESS: NumberGuessConfig;
  POLL: PollConfig;
}

export interface AnswerPayloadMap {
  SINGLE_CHOICE: { optionId: string };
  MULTIPLE_CHOICE: { optionIds: string[] };
  TRUE_FALSE: { value: boolean };
  IMAGE_CHOICE: { optionId: string };
  TYPE_ANSWER: { text: string };
  ORDERING: { itemIds: string[] };
  NUMBER_GUESS: { value: number };
  POLL: { optionId: string };
}

export type QuestionConfig = QuestionConfigMap[QuestionType];
export type AnswerPayload = AnswerPayloadMap[QuestionType];

/** Fields the admin edits. */
export type QuestionInput = {
  [T in QuestionType]: {
    type: T;
    text: string;
    imageUrl?: string | null;
    points: number;
    config: QuestionConfigMap[T];
  };
}[QuestionType];

export type Question = QuestionInput & {
  id: string;
  quizId: string;
  order: number;
};

/** What gamers see: configs stripped of anything that reveals the answer. */
export interface PublicQuestionConfig {
  options?: ChoiceOption[];
  items?: OrderItem[];
  multiple?: boolean;
  unit?: string | null;
}

export interface PublicQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string | null;
  points: number;
  config: PublicQuestionConfig;
}

export const QUESTION_TYPE_INFO: Record<
  QuestionType,
  { label: string; icon: string; hint: string }
> = {
  SINGLE_CHOICE: { label: 'Multiple choice', icon: '🔘', hint: 'Pick one correct answer' },
  MULTIPLE_CHOICE: { label: 'Multi-select', icon: '☑️', hint: 'Several answers can be correct' },
  TRUE_FALSE: { label: 'True / False', icon: '⚖️', hint: 'Is the statement true or false?' },
  IMAGE_CHOICE: { label: 'Picture answers', icon: '🖼️', hint: 'Pick the right picture' },
  TYPE_ANSWER: { label: 'Type the answer', icon: '⌨️', hint: 'Players type a short answer' },
  ORDERING: { label: 'Put in order', icon: '🔢', hint: 'Drag items into the right order' },
  NUMBER_GUESS: { label: 'Guess the number', icon: '🎯', hint: 'Closest within a tolerance wins' },
  POLL: { label: 'Poll', icon: '📊', hint: 'Just for fun, no right answer' },
};

export const DEFAULT_POINTS = 100;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MIN_ORDER_ITEMS = 3;
export const MAX_ORDER_ITEMS = 6;
