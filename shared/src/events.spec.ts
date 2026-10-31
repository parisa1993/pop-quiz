import { ClientEvents, ServerEvents } from './events.js';

describe('socket events', () => {
  it('uses unique event names', () => {
    const names = [...Object.values(ClientEvents), ...Object.values(ServerEvents)];
    expect(new Set(names).size).toBe(names.length);
  });

  it('namespaces admin events', () => {
    const admin = Object.entries(ClientEvents).filter(([key]) => key.startsWith('Admin'));
    expect(admin.every(([, name]) => name.startsWith('admin:'))).toBe(true);
  });
});
