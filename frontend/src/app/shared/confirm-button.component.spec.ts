import { TestBed } from '@angular/core/testing';
import { ConfirmButtonComponent } from './confirm-button.component';

describe('ConfirmButtonComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ConfirmButtonComponent);
    fixture.componentRef.setInput('question', 'Delete it?');
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const click = async (selector: string) => {
      (el.querySelector(selector) as HTMLButtonElement).click();
      await fixture.whenStable();
    };
    return { el, click, confirmed };
  }

  it('asks before confirming', async () => {
    const { el, click, confirmed } = await setup();
    await click('button');
    expect(el.textContent).toContain('Delete it?');
    await click('.btn--danger');
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(el.textContent).not.toContain('Delete it?');
  });

  it('can be cancelled', async () => {
    const { el, click, confirmed } = await setup();
    await click('button');
    await click('.btn--soft');
    expect(confirmed).not.toHaveBeenCalled();
    expect(el.textContent).not.toContain('Delete it?');
  });
});
