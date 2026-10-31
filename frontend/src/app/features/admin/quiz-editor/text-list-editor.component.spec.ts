import { TestBed } from '@angular/core/testing';
import { TextItem, TextListEditorComponent } from './text-list-editor.component';

describe('TextListEditorComponent', () => {
  async function setup(
    items: TextItem[],
    options: { min?: number; max?: number; draggable?: boolean } = {},
  ) {
    const fixture = TestBed.createComponent(TextListEditorComponent);
    fixture.componentRef.setInput('items', items);
    for (const [key, value] of Object.entries(options)) fixture.componentRef.setInput(key, value);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, changed };
  }

  const items = [
    { id: 'a', text: 'One' },
    { id: 'b', text: 'Two' },
  ];

  it('edits, adds and removes items', async () => {
    const { el, changed } = await setup(items);
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = 'Uno';
    input.dispatchEvent(new Event('input'));
    expect(changed).toHaveBeenLastCalledWith([{ id: 'a', text: 'Uno' }, items[1]]);

    (el.querySelector('.btn--soft') as HTMLButtonElement).click();
    expect(changed.mock.lastCall![0]).toHaveLength(3);

    (el.querySelectorAll('.icon-btn')[0] as HTMLButtonElement).click();
    expect(changed).toHaveBeenLastCalledWith([items[1]]);
  });

  it('respects min/max and shows numbers when draggable', async () => {
    const { el } = await setup(items, { min: 2, max: 2, draggable: true });
    expect((el.querySelector('.icon-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('.btn--soft')).toBeNull();
    expect(el.querySelectorAll('.list__num')).toHaveLength(2);
  });
});
