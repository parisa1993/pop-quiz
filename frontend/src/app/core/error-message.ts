import { HttpErrorResponse } from '@angular/common/http';

/** Turns any API/network error into one friendly sentence. */
export function errorMessage(error: unknown, fallback = 'Something went wrong, please try again'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return "Can't reach the server. Check your connection";
    const message = (error.error as { message?: unknown } | null)?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string' && message) return message;
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
