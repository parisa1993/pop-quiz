import { TestBed } from '@angular/core/testing';
import type { PublicQuestion } from '@pop-quiz/shared';
import { OrderingAnswerComponent } from './ordering-answer.component';

const question: PublicQuestion = {
  id: 'q',
  type: 'ORDERING',
  text: 'Order these',
  points: 100,
  config: {
    items: [
      { id: '3', text: 'Three' },
      { id: '1', text: 'One' },
      { id: '2', text: 'Two' },
    ],
  },
};

describe('OrderingAnswerComponent', () => {
  async function setup(answer: unknown = null, locked = false) {
    const fixture = TestBed.createComponent(OrderingAnswerComponent);
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('answer', answer);
    fixture.componentRef.setInput('locked', locked);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const texts = () => [...el.querySelectorAll('.order__text')].map((n) => n.textContent);
    return { fixture, el, texts, submitted };
  }

  it('reorders with the arrow buttons and submits the order', async () => {
    const { fixture, el, texts, submitted } = await setup();
    expect(texts()).toEqual(['Three', 'One', 'Two']);
    (el.querySelector('[aria-label="Move One up"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    (el.querySelector('[aria-label="Move Three down"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(texts()).toEqual(['One', 'Two', 'Three']);
    (el.querySelector('.btn--yellow') as HTMLButtonElement).click();
    expect(submitted).toHaveBeenCalledWith({ itemIds: ['1', '2', '3'] });
  });

  it('shows the saved order read-only', async () => {
    const { el, texts } = await setup({ itemIds: ['2', '3', '1'] }, true);
    expect(texts()).toEqual(['Two', 'Three', 'One']);
    expect(el.querySelector('.btn--yellow')).toBeNull();
    expect(el.textContent).toContain('Your order');
  });
});
