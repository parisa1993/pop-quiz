import { PlayersController } from './players.controller.js';
import type { PlayersService } from './players.service.js';

describe('PlayersController', () => {
  const service = {
    create: vi.fn(async (name: unknown) => ({ id: '1', username: name })),
    get: vi.fn(async (id: string) => ({ id, username: 'Sara' })),
  };
  const controller = new PlayersController(service as unknown as PlayersService);

  it('creates and fetches players', async () => {
    expect(await controller.create({ username: 'Sara' })).toEqual({ id: '1', username: 'Sara' });
    expect(await controller.get('1')).toEqual({ id: '1', username: 'Sara' });
  });

  it('passes undefined when the body is missing', async () => {
    await controller.create(undefined as never);
    expect(service.create).toHaveBeenLastCalledWith(undefined);
  });
});
