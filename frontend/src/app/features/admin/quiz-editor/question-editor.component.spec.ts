import { ComponentFixture, TestBed } from '@angular/core/testing';
import { choiceQuestion, createApiMock, provideApiMock, trueFalseQuestion } from '../../../../testing/test-helpers';
import { QuestionEditorComponent } from './question-editor.component';

describe('QuestionEditorComponent', () => {
  let fixture: ComponentFixture<QuestionEditorComponent>;
  let el: HTMLElement;
  let saved: ReturnType<typeof vi.fn<(value: any) => void>>;

  async function setup(question = null as typeof trueFalseQuestion | null) {
    TestBed.configureTestingModule({ providers: [provideApiMock(createApiMock())] });
    fixture = TestBed.createComponent(QuestionEditorComponent);
    fixture.componentRef.setInput('question', question);
    saved = vi.fn<(value: any) => void>();
    fixture.componentInstance.saved.subscribe((value) => saved(value));
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  }

  const type = async (selector: string, value: string, index = 0) => {
    const input = el.querySelectorAll(selector)[index] as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const pickType = async (label: string) => {
    const button = [...el.querySelectorAll('.type')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
  };
  const save = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  it('shows every question type', async () => {
    await setup();
    expect(el.querySelectorAll('.type')).toHaveLength(8);
    expect(el.querySelector('.type.is-active')?.textContent).toContain('Multiple choice');
  });

  it('shows validation errors instead of saving an incomplete question', async () => {
    await setup();
    await save();
    expect(saved).not.toHaveBeenCalled();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Write the question');
  });

  it('builds a multiple choice question', async () => {
    await setup();
    await type('textarea', 'Favourite colour?');
    await type('.option__text', 'Pink', 0);
    await type('.option__text', 'Blue', 1);
    await type('.option__text', 'Gold', 2);
    await type('.option__text', 'Green', 3);
    await save();
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SINGLE_CHOICE', text: 'Favourite colour?', points: 100 }),
    );
  });

  it('builds a true/false question with custom points', async () => {
    await setup();
    await pickType('True / False');
    await type('textarea', 'Sky is green');
    (el.querySelector('.tf__btn--false') as HTMLButtonElement).click();
    const preset = [...el.querySelectorAll('.presets .chip')].find((c) => c.textContent === '500') as HTMLButtonElement;
    preset.click();
    await fixture.whenStable();
    await save();
    expect(saved).toHaveBeenCalledWith({
      type: 'TRUE_FALSE',
      text: 'Sky is green',
      imageUrl: null,
      points: 500,
      config: { correct: false },
    });
  });

  it('builds type-answer, number and ordering questions', async () => {
    await setup();
    await pickType('Type the answer');
    await type('textarea', 'Cat name?');
    await type('app-text-list-editor input', 'Miso');
    await save();
    expect(saved).toHaveBeenLastCalledWith(expect.objectContaining({ config: { acceptedAnswers: ['Miso'] } }));

    await pickType('Guess the number');
    await type('.number input', '30', 0);
    await type('.number input', '2', 1);
    await type('.number input', 'years', 2);
    await save();
    expect(saved).toHaveBeenLastCalledWith(expect.objectContaining({ config: { correct: 30, tolerance: 2, unit: 'years' } }));

    await pickType('Put in order');
    for (const [i, text] of ['A', 'B', 'C'].entries()) await type('app-text-list-editor input', text, i);
    await save();
    expect(saved.mock.lastCall![0].config.items.map((i: { text: string }) => i.text)).toEqual(['A', 'B', 'C']);
  });

  it('keeps options when switching between choice types', async () => {
    await setup(choiceQuestion);
    await pickType('Multi-select');
    await save();
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MULTIPLE_CHOICE',
        config: expect.objectContaining({ correctOptionIds: ['a'] }),
      }),
    );
  });

  it('edits an existing question', async () => {
    await setup(trueFalseQuestion);
    expect((el.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Cake is great');
    expect(el.textContent).toContain('Save changes');
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    (el.querySelector('.editor__actions .btn--soft') as HTMLButtonElement).click();
    expect(cancelled).toHaveBeenCalled();
  });
});
