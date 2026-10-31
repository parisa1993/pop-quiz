import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it('uses the API message', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 409, error: { message: 'Name taken' } }))).toBe('Name taken');
    expect(errorMessage(new HttpErrorResponse({ status: 400, error: { message: ['A', 'B'] } }))).toBe('A. B');
  });

  it('explains network failures', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toMatch(/Can't reach the server/);
  });

  it('falls back sensibly', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500 }), 'Oops')).toBe('Oops');
    expect(errorMessage(new Error('Boom'))).toBe('Boom');
    expect(errorMessage('weird')).toBe('Something went wrong, please try again');
  });
});
