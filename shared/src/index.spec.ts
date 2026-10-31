import * as shared from './index.js';

describe('public API', () => {
  it('re-exports every module', () => {
    expect(shared.gradeAnswer).toBeTypeOf('function');
    expect(shared.validateQuestionInput).toBeTypeOf('function');
    expect(shared.ClientEvents.PlayerJoin).toBe('player:join');
    expect(shared.QUESTION_TYPES.length).toBe(8);
    expect(shared.ADMIN_PASSWORD_DEFAULT).toBe('9999');
  });
});
