import { TestBed } from '@angular/core/testing';
import type { PublicQuestion } from '@pop-quiz/shared';
import { FreeAnswerComponent } from './free-answer.component';

const typed: PublicQuestion = { id: 'q', type: 'TYPE_ANSWER', text: 'Cat name?', points: 100, config: {} };
const number: PublicQuestion = { id: 'q', type: 'NUMBER_GUESS', text: 'Age?', points: 100, config: { unit: 'years' } };

describe('FreeAnswerComponent', () => {
  async function setup(question: PublicQuestion, answer: unknown = null, locked = false) {
    const fixture = TestBed.createComponent(FreeAnswerComponent);
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('answer', answer);
    fixture.componentRef.setInput('locked', locked);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const submit = () => el.querySelector('form')!.dispatchEvent(new Event('submit'));
    return { el, input, type, submit, submitted };
  }

  it('submits trimmed text', async () => {
    const { type, submit, submitted, el } = await setup(typed);
    expect((el.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    await type('  Miso ');
    submit();
    expect(submitted).toHaveBeenCalledWith({ text: 'Miso' });
  });

  it('submits numbers and shows the unit', async () => {
    const { type, submit, submitted, el, input } = await setup(number);
    expect(input.type).toBe('number');
    expect(el.textContent).toContain('years');
    await type('30.5');
    submit();
    expect(submitted).toHaveBeenCalledWith({ value: 30.5 });
  });

  it('shows the saved answer read-only', async () => {
    const { input, el, submit, submitted } = await setup(number, { value: 42 }, true);
    expect(input.value).toBe('42');
    expect(input.disabled).toBe(true);
    expect(el.querySelector('button')).toBeNull();
    submit();
    expect(submitted).not.toHaveBeenCalled();
  });
});
