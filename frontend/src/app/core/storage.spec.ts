import { storage } from './storage';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips JSON values', () => {
    storage.set('k', { a: 1 });
    expect(storage.get('k')).toEqual({ a: 1 });
  });

  it('removes keys when set to null and returns null for missing or broken values', () => {
    storage.set('k', 'v');
    storage.set('k', null);
    expect(storage.get('k')).toBeNull();
    localStorage.setItem('bad', '{oops');
    expect(storage.get('bad')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => storage.set('k', 1)).not.toThrow();
    spy.mockRestore();
  });
});
