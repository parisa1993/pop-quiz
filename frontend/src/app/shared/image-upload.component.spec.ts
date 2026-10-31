import { TestBed } from '@angular/core/testing';
import { ImageResizeService } from '../core/image-resize.service';
import { ToastService } from '../core/toast.service';
import { createApiMock, flush, provideApiMock } from '../../testing/test-helpers';
import { ImageUploadComponent } from './image-upload.component';

describe('ImageUploadComponent', () => {
  function setup(upload = vi.fn().mockResolvedValue('/uploads/x.jpg')) {
    const api = createApiMock({ uploadImage: upload });
    const toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideApiMock(api),
        { provide: ToastService, useValue: toast },
        { provide: ImageResizeService, useValue: { resize: async (f: File) => ({ blob: f, name: f.name }) } },
      ],
    });
    const fixture = TestBed.createComponent(ImageUploadComponent);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    return { fixture, api, toast, changed };
  }

  async function pick(fixture: ReturnType<typeof setup>['fixture'], file: File) {
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
  }

  it('uploads the picked picture and emits its URL', async () => {
    const { fixture, api, changed } = setup();
    await pick(fixture, new File(['x'], 'cake.png', { type: 'image/png' }));
    expect(api.uploadImage).toHaveBeenCalled();
    expect(changed).toHaveBeenCalledWith('/uploads/x.jpg');
  });

  it('rejects non-images and reports upload errors', async () => {
    const { fixture, toast, changed } = setup(vi.fn().mockRejectedValue(new Error('Too big')));
    await pick(fixture, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(toast.error).toHaveBeenCalledWith('Please choose a picture');
    await pick(fixture, new File(['x'], 'cake.png', { type: 'image/png' }));
    expect(toast.error).toHaveBeenCalledWith('Too big');
    expect(changed).not.toHaveBeenCalled();
  });

  it('shows a preview with a remove button', async () => {
    const { fixture, changed } = setup();
    fixture.componentRef.setInput('url', '/uploads/a.png');
    await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('/uploads/a.png');
    (fixture.nativeElement.querySelector('.upload__remove') as HTMLButtonElement).click();
    expect(changed).toHaveBeenCalledWith(null);
  });
});
