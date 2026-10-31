const fakeApp = {
  setGlobalPrefix: vi.fn(),
  enableCors: vi.fn(),
  enableShutdownHooks: vi.fn(),
  useStaticAssets: vi.fn(),
  listen: vi.fn(async () => undefined),
};

vi.mock('@nestjs/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  NestFactory: { create: vi.fn(async () => fakeApp) },
}));

describe('main', () => {
  it('boots the app on the configured port', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env['UPLOADS_DIR'] = 'test/tmp/uploads';
    await import('./main.js');
    expect(fakeApp.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(fakeApp.listen).toHaveBeenCalledWith(3000, '0.0.0.0');
    delete process.env['UPLOADS_DIR'];
  });
});
