import { Test } from '@nestjs/testing';
import { loadConfig } from '../config.js';
import { AppConfigModule } from '../config.module.js';
import { AdminGuard } from './admin.guard.js';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';

describe('AuthModule', () => {
  it('wires the service and guard', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule.forRoot(loadConfig({})), AuthModule],
    }).compile();

    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
    expect(moduleRef.get(AdminGuard)).toBeInstanceOf(AdminGuard);
  });
});
