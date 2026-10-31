import { Test } from '@nestjs/testing';
import { APP_CONFIG, loadConfig } from './config.js';
import { AppConfigModule } from './config.module.js';

describe('AppConfigModule', () => {
  it('provides the given config globally', async () => {
    const config = { ...loadConfig({}), adminPassword: '4242' };
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule.forRoot(config)] }).compile();
    expect(moduleRef.get(APP_CONFIG)).toBe(config);
  });

  it('defaults to the environment config', () => {
    const dynamic = AppConfigModule.forRoot();
    expect(dynamic.global).toBe(true);
    expect(dynamic.exports).toEqual([APP_CONFIG]);
  });
});
