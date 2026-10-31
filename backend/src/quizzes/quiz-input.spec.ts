import { BadRequestException } from '@nestjs/common';
import { parseQuizInput } from './quiz-input.js';

describe('parseQuizInput', () => {
  it('requires a title when creating', () => {
    expect(() => parseQuizInput({}, false)).toThrow('Give the quiz a title');
    expect(() => parseQuizInput(null, false)).toThrow(BadRequestException);
  });

  it('trims and normalizes fields', () => {
    expect(
      parseQuizInput(
        { title: ' Fun ', description: '  ', coverImageUrl: '/u/a.png', enabled: true },
        false,
      ),
    ).toEqual({
      title: 'Fun',
      description: null,
      coverImageUrl: '/u/a.png',
      enabled: true,
    });
  });

  it('only includes provided fields for updates', () => {
    expect(parseQuizInput({ enabled: false }, true)).toEqual({ enabled: false });
    expect(parseQuizInput({ description: null }, true)).toEqual({ description: null });
  });

  it('rejects invalid values', () => {
    expect(() => parseQuizInput({ title: 'x'.repeat(121) }, false)).toThrow('Title is too long');
    expect(() => parseQuizInput({ enabled: 'yes' }, true)).toThrow('Enabled must be true or false');
    expect(() => parseQuizInput({ description: 5 }, true)).toThrow('Description must be text');
    expect(() => parseQuizInput({ description: 'x'.repeat(1001) }, true)).toThrow(
      'Description is too long',
    );
  });
});
