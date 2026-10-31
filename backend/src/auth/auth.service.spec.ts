import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { loadConfig } from '../config.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const config = { ...loadConfig({}), adminPassword: '9999', jwtSecret: 'secret' };
  const service = new AuthService(new JwtService({}), config);

  it('issues a token for the right password', async () => {
    const token = await service.login('9999');
    expect(await service.isAdminToken(token)).toBe(true);
  });

  it('rejects wrong or missing passwords', async () => {
    await expect(service.login('0000')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('99999')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid tokens', async () => {
    expect(await service.isAdminToken('garbage')).toBe(false);
    expect(await service.isAdminToken(undefined)).toBe(false);
    const foreign = await new JwtService({}).signAsync({ role: 'admin' }, { secret: 'other' });
    expect(await service.isAdminToken(foreign)).toBe(false);
    const notAdmin = await new JwtService({}).signAsync({ role: 'player' }, { secret: 'secret' });
    expect(await service.isAdminToken(notAdmin)).toBe(false);
  });
});
