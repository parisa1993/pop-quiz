import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { storage, STORAGE_KEYS } from './storage';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly api = inject(ApiService);
  readonly token = signal<string | null>(storage.get<string>(STORAGE_KEYS.adminToken));
  readonly isLoggedIn = computed(() => !!this.token());

  async login(password: string): Promise<void> {
    const token = await this.api.adminLogin(password);
    this.token.set(token);
    storage.set(STORAGE_KEYS.adminToken, token);
  }

  logout(): void {
    this.token.set(null);
    storage.set(STORAGE_KEYS.adminToken, null);
  }
}
