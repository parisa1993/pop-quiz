import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  it('returns a token from the service', async () => {
    const auth = { login: vi.fn().mockResolvedValue('jwt') };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();

    const controller = moduleRef.get(AuthController);
    await expect(controller.login({ password: '9999' })).resolves.toEqual({ token: 'jwt' });
    expect(auth.login).toHaveBeenCalledWith('9999');
  });
});
