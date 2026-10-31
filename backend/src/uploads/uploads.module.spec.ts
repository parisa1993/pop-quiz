import { Test } from '@nestjs/testing';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { loadConfig } from '../config.js';
import { AppConfigModule } from '../config.module.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsModule } from './uploads.module.js';

describe('UploadsModule', () => {
  it('provides the upload controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule.forRoot(loadConfig({})), UploadsModule],
    })
      .useMocker((token) => (token === AuthService || token === AdminGuard ? {} : undefined))
      .compile();
    expect(moduleRef.get(UploadsController)).toBeInstanceOf(UploadsController);
  });
});
