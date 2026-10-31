import { TestBed } from '@angular/core/testing';
import { ToastService } from '../core/toast.service';
import { ToastHostComponent } from './toast-host.component';

describe('ToastHostComponent', () => {
  it('renders toasts and dismisses on tap', async () => {
    const fixture = TestBed.createComponent(ToastHostComponent);
    const toasts = TestBed.inject(ToastService);
    toasts.success('Saved!');
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('.toast--success') as HTMLButtonElement;
    expect(button.textContent).toContain('Saved!');
    button.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });
});
