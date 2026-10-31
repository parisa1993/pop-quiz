import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SOCKET_FACTORY, SocketService } from './socket.service';

function fakeIo() {
  const handlers = new Map<string, ((value: unknown) => void)[]>();
  const socket = {
    on: vi.fn((event: string, handler: (value: unknown) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    off: vi.fn((event: string, handler: (value: unknown) => void) => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((h) => h !== handler),
      );
    }),
    disconnect: vi.fn(),
    timeout: vi.fn(() => socket),
    emitWithAck: vi.fn(async () => ({ ok: true, data: 42 })),
    fire: (event: string, value?: unknown) => (handlers.get(event) ?? []).forEach((h) => h(value)),
  };
  return socket;
}

describe('SocketService', () => {
  let sockets: ReturnType<typeof fakeIo>[];
  let factory: ReturnType<typeof vi.fn>;
  let service: SocketService;

  beforeEach(() => {
    sockets = [];
    factory = vi.fn(() => {
      const s = fakeIo();
      sockets.push(s);
      return s;
    });
    TestBed.configureTestingModule({ providers: [{ provide: SOCKET_FACTORY, useValue: factory }] });
    service = TestBed.inject(SocketService);
  });

  it('connects once per token and tracks connection state', () => {
    service.connect();
    service.connect();
    expect(factory).toHaveBeenCalledTimes(1);
    sockets[0].fire('connect');
    expect(service.connected()).toBe(true);
    sockets[0].fire('disconnect');
    expect(service.connected()).toBe(false);

    service.connect('admin-token');
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory.mock.calls[1][0]).toMatchObject({ auth: { token: 'admin-token' } });
    expect(sockets[0].disconnect).toHaveBeenCalled();
  });

  it('streams server events and unsubscribes', async () => {
    service.connect();
    const next = firstValueFrom(service.on<number>('game:state'));
    sockets[0].fire('game:state', 7);
    expect(await next).toBe(7);
    expect(sockets[0].off).toHaveBeenCalled();
  });

  it('emits with acknowledgement and handles timeouts', async () => {
    expect(await service.emit('x', {})).toEqual({ ok: true, data: 42 });
    sockets[0].emitWithAck.mockRejectedValueOnce(new Error('timeout'));
    expect(await service.emit('x', {})).toEqual({
      ok: false,
      error: 'Connection hiccup, please try again',
    });
  });

  it('disconnects cleanly', () => {
    service.connect();
    service.disconnect();
    expect(sockets[0].disconnect).toHaveBeenCalled();
    expect(service.connected()).toBe(false);
  });
});
