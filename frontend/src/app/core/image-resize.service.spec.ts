import { TestBed } from '@angular/core/testing';
import { ImageResizeService } from './image-resize.service';

describe('ImageResizeService', () => {
  const service = () => TestBed.inject(ImageResizeService);

  it('passes small files and GIFs through untouched', async () => {
    const small = new File(['x'], 'cat.png', { type: 'image/png' });
    expect(await service().resize(small)).toEqual({ blob: small, name: 'cat.png' });
    const gif = new File([new Uint8Array(300 * 1024)], 'party.gif', { type: 'image/gif' });
    expect((await service().resize(gif)).blob).toBe(gif);
  });

  it('falls back to the original when the browser cannot decode it', async () => {
    const big = new File([new Uint8Array(300 * 1024)], 'photo.jpeg', { type: 'image/jpeg' });
    const result = await service().resize(big);
    expect(result).toEqual({ blob: big, name: 'photo.jpeg' });
  });

  it('shrinks big photos to JPEG', async () => {
    const big = new File([new Uint8Array(300 * 1024)], 'photo.png', { type: 'image/png' });
    const bitmap = { width: 4000, height: 2000, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    const out = new Blob(['jpg'], { type: 'image/jpeg' });
    const ctx = { drawImage: vi.fn() };
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === 'canvas') {
        Object.assign(el, { getContext: () => ctx, toBlob: (cb: (b: Blob) => void) => cb(out) });
      }
      return el;
    });

    const result = await service().resize(big, 1000);
    expect(result).toEqual({ blob: out, name: 'photo.jpg' });
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1000, 500);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
