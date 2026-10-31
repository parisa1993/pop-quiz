import { Injectable } from '@angular/core';

export const MAX_IMAGE_SIDE = 1280;

/** Shrinks big phone photos before upload so they load fast on everyone's phone. */
@Injectable({ providedIn: 'root' })
export class ImageResizeService {
  async resize(file: File, maxSide = MAX_IMAGE_SIDE): Promise<{ blob: Blob; name: string }> {
    // GIFs would lose their animation; tiny files don't need it.
    if (file.type === 'image/gif' || file.size < 200 * 1024) return { blob: file, name: file.name };

    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) return { blob: file, name: file.name };
      return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
    } catch {
      return { blob: file, name: file.name };
    }
  }
}
