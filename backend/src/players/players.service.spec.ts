import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createTestDb, type TestDb } from '../testing/test-db.js';
import { normalizeUsername, PlayersService } from './players.service.js';

describe('normalizeUsername', () => {
  it('trims, collapses spaces and builds a case-insensitive key', () => {
    expect(normalizeUsername('  Party   Animal ')).toEqual({
      username: 'Party Animal',
      key: 'party animal',
    });
  });

  it('enforces length and type', () => {
    expect(() => normalizeUsername('a')).toThrow(BadRequestException);
    expect(() => normalizeUsername('x'.repeat(21))).toThrow(BadRequestException);
    expect(() => normalizeUsername(42)).toThrow('Pick a name');
  });
});

describe('PlayersService', () => {
  let db: TestDb;
  let service: PlayersService;

  beforeEach(async () => {
    db = await createTestDb();
    service = new PlayersService(db.prisma);
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates players with unique names', async () => {
    const player = await service.create('Sara');
    expect(player).toEqual({ id: expect.any(String), username: 'Sara' });
    await expect(service.create('SARA')).rejects.toBeInstanceOf(ConflictException);
  });

  it('finds players for auto-login', async () => {
    const player = await service.create('Sara');
    expect(await service.get(player.id)).toEqual(player);
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
