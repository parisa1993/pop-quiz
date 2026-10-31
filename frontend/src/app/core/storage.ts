/** localStorage that never throws (private mode, blocked storage…). */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable: the app still works, it just won't remember you.
    }
  },
};

export const STORAGE_KEYS = {
  adminToken: 'popquiz.adminToken',
  player: 'popquiz.player',
  sessionId: 'popquiz.sessionId',
} as const;
