import { TestBed } from '@angular/core/testing';
import { createApiMock, provideApiMock } from '../../../../testing/test-helpers';
import { ChoiceOptionsEditorComponent, CorrectMode } from './choice-options-editor.component';

const options = [
  { id: 'a', text: 'Pink' },
  { id: 'b', text: 'Blue' },
  { id: 'c', text: 'Gold' },
];

describe('ChoiceOptionsEditorComponent', () => {
  async function setup(mode: CorrectMode, correctIds: string[], images = false) {
    TestBed.configureTestingModule({ providers: [provideApiMock(createApiMock())] });
    const fixture = TestBed.createComponent(ChoiceOptionsEditorComponent);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('correctIds', correctIds);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('images', images);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, changed };
  }

  it('picks exactly one correct answer in single mode', async () => {
    const { el, changed } = await setup('single', ['a']);
    const radios = el.querySelectorAll('input[type=radio]');
    expect(radios).toHaveLength(3);
    radios[2].dispatchEvent(new Event('change'));
    expect(changed).toHaveBeenCalledWith({ options, correctIds: ['c'] });
  });

  it('toggles several correct answers in multi mode', async () => {
    const { el, changed } = await setup('multi', ['a']);
    const boxes = el.querySelectorAll('input[type=checkbox]');
    boxes[1].dispatchEvent(new Event('change'));
    expect(changed).toHaveBeenLastCalledWith({ options, correctIds: ['a', 'b'] });
    boxes[0].dispatchEvent(new Event('change'));
    expect(changed).toHaveBeenLastCalledWith({ options, correctIds: [] });
  });

  it('has no correct toggles for polls', async () => {
    const { el } = await setup('none', []);
    expect(el.querySelector('.option__correct')).toBeNull();
    expect(el.textContent).toContain('Polls have no right answer');
  });

  it('edits text, adds and removes options, keeping a correct answer', async () => {
    const { el, changed } = await setup('single', ['a']);
    const input = el.querySelector('.option__text') as HTMLInputElement;
    input.value = 'Rose';
    input.dispatchEvent(new Event('input'));
    expect(changed.mock.lastCall![0].options[0].text).toBe('Rose');

    (el.querySelector('.btn--soft') as HTMLButtonElement).click();
    expect(changed.mock.lastCall![0].options).toHaveLength(4);

    (el.querySelector('.option .icon-btn') as HTMLButtonElement).click();
    expect(changed).toHaveBeenLastCalledWith({ options: options.slice(1), correctIds: ['b'] });
  });

  it('shows picture pickers for image answers', async () => {
    const { el } = await setup('single', ['a'], true);
    expect(el.querySelectorAll('app-image-upload')).toHaveLength(3);
  });
});
