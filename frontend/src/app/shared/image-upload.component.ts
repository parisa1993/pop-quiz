import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/error-message';
import { ImageResizeService } from '../core/image-resize.service';
import { ToastService } from '../core/toast.service';

/** Pick a picture, shrink it, upload it, and show a preview. Emits the uploaded URL (or null). */
@Component({
  selector: 'app-image-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="upload" [class.upload--compact]="compact()">
      @if (url(); as src) {
        <img [src]="src" [alt]="label()" class="upload__preview" />
        <button type="button" class="icon-btn upload__remove" (click)="changed.emit(null)" aria-label="Remove picture">
          ✕
        </button>
      } @else {
        <label class="upload__drop" [class.is-busy]="busy()">
          <input type="file" accept="image/*" (change)="onFile($event)" [disabled]="busy()" />
          @if (busy()) {
            <span>Uploading…</span>
          } @else {
            <span aria-hidden="true" class="upload__icon">📷</span>
            <span>{{ label() }}</span>
          }
        </label>
      }
    </div>
  `,
  styles: `
    .upload {
      position: relative;
      border-radius: var(--radius-m);
      overflow: hidden;
      background: var(--c-surface-2);
      aspect-ratio: 16 / 9;
      max-height: 220px;
    }
    .upload--compact {
      aspect-ratio: 1;
      max-height: none;
    }
    .upload__preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .upload__remove {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      background: rgba(255, 255, 255, 0.92);
    }
    .upload__drop {
      height: 100%;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--space-1);
      padding: var(--space-3);
      border: 2px dashed #c9bdf0;
      border-radius: var(--radius-m);
      color: var(--c-ink-soft);
      font-weight: 700;
      font-size: var(--fs-s);
      text-align: center;
      cursor: pointer;
    }
    .upload__drop input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
    }
    .upload__drop:focus-within {
      outline: 3px solid var(--c-yellow);
    }
    .upload__icon {
      font-size: 1.6rem;
    }
    .is-busy {
      opacity: 0.6;
    }
  `,
})
export class ImageUploadComponent {
  private readonly api = inject(ApiService);
  private readonly resizer = inject(ImageResizeService);
  private readonly toast = inject(ToastService);

  readonly url = input<string | null | undefined>(null);
  readonly label = input('Add a picture');
  readonly compact = input(false);
  readonly changed = output<string | null>();
  protected readonly busy = signal(false);

  protected async onFile(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose a picture');
      return;
    }
    this.busy.set(true);
    try {
      const { blob, name } = await this.resizer.resize(file);
      this.changed.emit(await this.api.uploadImage(blob, name));
    } catch (error) {
      this.toast.error(errorMessage(error, 'Upload failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
