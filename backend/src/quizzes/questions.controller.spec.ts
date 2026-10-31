import type { QuestionInput } from '@pop-quiz/shared';
import { QuestionsController } from './questions.controller.js';
import type { QuestionsService } from './questions.service.js';

describe('QuestionsController', () => {
  const service = {
    create: vi.fn(async () => 'created'),
    reorder: vi.fn(async () => 'reordered'),
    update: vi.fn(async () => 'updated'),
    remove: vi.fn(async () => undefined),
  };
  const controller = new QuestionsController(service as unknown as QuestionsService);
  const body = { type: 'TRUE_FALSE', text: 'Q', points: 100, config: { correct: true } } as QuestionInput;

  it('delegates every route to the service', async () => {
    expect(await controller.create('z', body)).toBe('created');
    expect(service.create).toHaveBeenCalledWith('z', body);
    expect(await controller.reorder('z', { ids: ['a', 'b'] })).toBe('reordered');
    expect(service.reorder).toHaveBeenCalledWith('z', ['a', 'b']);
    expect(await controller.update('q', body)).toBe('updated');
    await controller.remove('q');
    expect(service.remove).toHaveBeenCalledWith('q');
  });
});
