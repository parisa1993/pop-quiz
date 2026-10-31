import { ADMIN_PASSWORD_DEFAULT, USERNAME_MAX, USERNAME_MIN } from './dto.js';

describe('dto constants', () => {
  it('defines the default admin password and username limits', () => {
    expect(ADMIN_PASSWORD_DEFAULT).toBe('9999');
    expect(USERNAME_MIN).toBeLessThan(USERNAME_MAX);
  });
});
