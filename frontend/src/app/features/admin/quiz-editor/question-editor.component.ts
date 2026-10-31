import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import {
  ChoiceOption,
  createDefaultConfig,
  DEFAULT_POINTS,
  MAX_ORDER_ITEMS,
  MIN_ORDER_ITEMS,
  newId,
  NumberGuessConfig,
  Question,
  QuestionConfig,
  QuestionInput,
  QuestionType,
  QUESTION_TYPE_INFO,
  QUESTION_TYPES,
  validateQuestionInput,
} from '@pop-quiz/shared';
import { ImageUploadComponent } from '../../../shared/image-upload.component';
import { ChoiceChange, ChoiceOptionsEditorComponent, CorrectMode } from './choice-options-editor.component';
import { TextItem, TextListEditorComponent } from './text-list-editor.component';

interface Draft {
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  points: number;
  config: QuestionConfig;
}

type Loose = Record<string, unknown>;
const CHOICE_TYPES: QuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'IMAGE_CHOICE', 'POLL'];
const POINT_PRESETS = [50, 100, 200, 500];

function toDraft(question: Question | null): Draft {
  if (!question) {
    return { type: 'SINGLE_CHOICE', text: '', imageUrl: null, points: DEFAULT_POINTS, config: createDefaultConfig('SINGLE_CHOICE') };
  }
  return {
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl ?? null,
    points: question.points,
    config: structuredClone(question.config),
  };
}

@Component({
  selector: 'app-question-editor',
  imports: [ImageUploadComponent, ChoiceOptionsEditorComponent, TextListEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-editor.component.html',
  styleUrl: './question-editor.component.scss',
})
export class QuestionEditorComponent {
  /** The question being edited, or null for a new one. */
  readonly question = input<Question | null>(null);
  readonly saving = input(false);
  readonly saved = output<QuestionInput>();
  readonly cancelled = output<void>();

  protected readonly types = QUESTION_TYPES;
  protected readonly info = QUESTION_TYPE_INFO;
  protected readonly pointPresets = POINT_PRESETS;
  protected readonly minItems = MIN_ORDER_ITEMS;
  protected readonly maxItems = MAX_ORDER_ITEMS;

  protected readonly draft = linkedSignal<Draft>(() => toDraft(this.question()));
  protected readonly showErrors = signal(false);
  protected readonly validation = computed(() => validateQuestionInput(this.draft()));
  protected readonly errors = computed(() => {
    const result = this.validation();
    return result.valid ? [] : result.errors;
  });

  private readonly config = computed(() => this.draft().config as unknown as Loose);
  protected readonly isChoice = computed(() => CHOICE_TYPES.includes(this.draft().type));
  protected readonly options = computed(() => (this.config()['options'] as ChoiceOption[] | undefined) ?? []);
  protected readonly correctIds = computed(() => {
    const c = this.config();
    if (Array.isArray(c['correctOptionIds'])) return c['correctOptionIds'] as string[];
    return typeof c['correctOptionId'] === 'string' ? [c['correctOptionId']] : [];
  });
  protected readonly correctMode = computed<CorrectMode>(() => {
    const type = this.draft().type;
    return type === 'POLL' ? 'none' : type === 'MULTIPLE_CHOICE' ? 'multi' : 'single';
  });
  protected readonly trueFalse = computed(() => this.config()['correct'] === true);
  protected readonly accepted = computed<TextItem[]>(() =>
    ((this.config()['acceptedAnswers'] as string[] | undefined) ?? []).map((text, i) => ({ id: `a${i}`, text })),
  );
  protected readonly orderItems = computed(() => (this.config()['items'] as TextItem[] | undefined) ?? []);
  protected readonly numberConfig = computed(() => this.config() as unknown as NumberGuessConfig);

  protected patch(changes: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...changes }));
  }

  protected patchConfig(changes: Loose): void {
    this.draft.update((d) => ({ ...d, config: { ...(d.config as unknown as Loose), ...changes } as unknown as QuestionConfig }));
  }

  /** Switching type keeps the text and image, and keeps answers between choice-like types. */
  protected changeType(type: QuestionType): void {
    const current = this.draft();
    if (type === current.type) return;
    const config = createDefaultConfig(type) as unknown as Loose;
    if (CHOICE_TYPES.includes(type) && CHOICE_TYPES.includes(current.type)) {
      const options = this.options().map((o) => ({ ...o, id: o.id || newId() }));
      const firstCorrect = this.correctIds()[0] ?? options[0]?.id;
      config['options'] = options;
      if ('correctOptionId' in config) config['correctOptionId'] = firstCorrect;
      if ('correctOptionIds' in config) config['correctOptionIds'] = firstCorrect ? [firstCorrect] : [];
    }
    this.draft.set({ ...current, type, config: config as unknown as QuestionConfig });
  }

  protected onChoices(change: ChoiceChange): void {
    const type = this.draft().type;
    if (type === 'MULTIPLE_CHOICE') this.patchConfig({ options: change.options, correctOptionIds: change.correctIds });
    else if (type === 'POLL') this.patchConfig({ options: change.options });
    else this.patchConfig({ options: change.options, correctOptionId: change.correctIds[0] ?? '' });
  }

  protected onAccepted(items: TextItem[]): void {
    this.patchConfig({ acceptedAnswers: items.map((i) => i.text) });
  }

  protected onNumber(field: 'correct' | 'tolerance', raw: string): void {
    this.patchConfig({ [field]: raw === '' ? NaN : Number(raw) });
  }

  protected save(): void {
    const result = this.validation();
    if (!result.valid) {
      this.showErrors.set(true);
      return;
    }
    this.saved.emit(result.value);
  }
}
