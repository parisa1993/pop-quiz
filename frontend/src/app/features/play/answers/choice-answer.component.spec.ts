import { TestBed } from '@angular/core/testing';
import type { PublicQuestion } from '@pop-quiz/shared';
import { publicChoice } from '../../../../testing/test-helpers';
import { ChoiceAnswerComponent } from './choice-answer.component';

describe('ChoiceAnswerComponent', () => {
  async function setup(question: PublicQuestion, answer: unknown = null, locked = false) {
    const fixture = TestBed.createComponent(ChoiceAnswerComponent);
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('answer', answer);
    fixture.componentRef.setInput('locked', locked);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const tiles = () => [...el.querySelectorAll('.tile')] as HTMLButtonElement[];
    return { fixture, el, tiles, submitted };
  }

  it('submits a single choice on tap', async () => {
    const { tiles, submitted } = await setup(publicChoice);
    expect(tiles().map((t) => t.textContent?.trim())).toEqual([
      expect.stringContaining('Pink'),
      expect.stringContaining('Blue'),
    ]);
    tiles()[1].click();
    expect(submitted).toHaveBeenCalledWith({ optionId: 'b' });
  });

  it('turns true/false into two tiles', async () => {
    const { tiles, submitted } = await setup({ ...publicChoice, type: 'TRUE_FALSE', config: {} });
    expect(tiles()).toHaveLength(2);
    tiles()[1].click();
    expect(submitted).toHaveBeenCalledWith({ value: false });
  });

  it('collects several picks for multi-select', async () => {
    const { tiles, el, fixture, submitted } = await setup({
      ...publicChoice,
      type: 'MULTIPLE_CHOICE',
      config: { ...publicChoice.config, multiple: true },
    });
    const lock = () => el.querySelector('.submit') as HTMLButtonElement;
    expect(lock().disabled).toBe(true);
    tiles()[0].click();
    tiles()[1].click();
    tiles()[1].click();
    tiles()[1].click();
    await fixture.whenStable();
    lock().click();
    expect(submitted).toHaveBeenCalledWith({ optionIds: ['a', 'b'] });
  });

  it('shows the saved answer and blocks changes when locked', async () => {
    const { tiles, submitted } = await setup(publicChoice, { optionId: 'a' }, true);
    expect(tiles()[0].classList).toContain('is-picked');
    expect(tiles()[1].classList).toContain('is-dimmed');
    expect(tiles()[1].disabled).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('renders pictures for image answers', async () => {
    const { el } = await setup({
      ...publicChoice,
      type: 'IMAGE_CHOICE',
      config: {
        options: [
          { id: 'x', text: '', imageUrl: '/u/x.png' },
          { id: 'y', text: '', imageUrl: '/u/y.png' },
        ],
      },
    });
    expect(el.querySelectorAll('img.tile__img')).toHaveLength(2);
    expect(el.textContent).toContain('Picture 1');
  });
});
