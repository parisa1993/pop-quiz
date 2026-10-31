import { QuizzesController } from './quizzes.controller.js';
import type { QuizzesService } from './quizzes.service.js';

describe('QuizzesController', () => {
  const service = {
    list: vi.fn(async () => ['list']),
    get: vi.fn(async (id: string) => ({ id })),
    create: vi.fn(async (body: unknown) => ({ created: body })),
    update: vi.fn(async (id: string, body: unknown) => ({ id, body })),
    remove: vi.fn(async () => undefined),
  };
  const controller = new QuizzesController(service as unknown as QuizzesService);

  it('delegates every route to the service', async () => {
    expect(await controller.list()).toEqual(['list']);
    expect(await controller.get('z')).toEqual({ id: 'z' });
    expect(await controller.create({ title: 'T' })).toEqual({ created: { title: 'T' } });
    expect(await controller.update('z', { enabled: true })).toEqual({ id: 'z', body: { enabled: true } });
    await controller.remove('z');
    expect(service.remove).toHaveBeenCalledWith('z');
  });
});
