import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { createApiMock, flush, provideApiMock } from '../../../testing/test-helpers';
import { PlayerSessionService } from '../../core/player-session.service';
import { PickNamePage } from './pick-name.page';

describe('PickNamePage', () => {
  async function setup(createPlayer = vi.fn().mockResolvedValue({ id: 'p1', username: 'Ana' })) {
    localStorage.clear();
    const api = createApiMock({ createPlayer });
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideApiMock(api)] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PickNamePage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = async (value: string) => {
      const input = el.querySelector('input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await flush();
      await fixture.whenStable();
    };
    return { el, api, navigate, type, submit };
  }

  it('keeps the button disabled until the name is long enough', async () => {
    const { el, type } = await setup();
    const button = () => el.querySelector('button.btn--pink') as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    await type('Ana');
    expect(button().disabled).toBe(false);
  });

  it('registers and goes to the game list', async () => {
    const { api, navigate, type, submit } = await setup();
    await type('Ana');
    await submit();
    expect(api.createPlayer).toHaveBeenCalledWith('Ana');
    expect(TestBed.inject(PlayerSessionService).player()?.username).toBe('Ana');
    expect(navigate).toHaveBeenCalledWith(['/play'], { replaceUrl: true });
  });

  it('shows a friendly error when the name is taken', async () => {
    const taken = new HttpErrorResponse({ status: 409, error: { message: '"Ana" is already taken' } });
    const { el, type, submit } = await setup(vi.fn().mockRejectedValue(taken));
    await type('Ana');
    await submit();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('already taken');
  });

  it('fills in a suggestion', async () => {
    const { el } = await setup();
    (el.querySelector('.pick__ideas button') as HTMLButtonElement).click();
    await flush();
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('Cake Boss');
  });
});
