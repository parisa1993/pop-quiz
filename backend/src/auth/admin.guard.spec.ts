import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard.js';
import { AuthService } from './auth.service.js';

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  }) as unknown as ExecutionContext;

describe('AdminGuard', () => {
  const auth = { isAdminToken: vi.fn(async (t: string) => t === 'good') } as unknown as AuthService;
  const guard = new AdminGuard(auth);

  it('allows a valid bearer token', async () => {
    await expect(guard.canActivate(contextWith('Bearer good'))).resolves.toBe(true);
  });

  it('rejects missing, malformed or invalid tokens', async () => {
    await expect(guard.canActivate(contextWith())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(contextWith('good'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(guard.canActivate(contextWith('Bearer bad'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
