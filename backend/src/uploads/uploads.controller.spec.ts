import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { UploadsController } from './uploads.controller.js';

describe('UploadsController', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pop-quiz-uploads-'));
  const controller = new UploadsController({ ...loadConfig({}), uploadsDir: path.join(dir, 'uploads') });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('saves images with a random name', async () => {
    const { url } = await controller.upload({ buffer: Buffer.from('png'), mimetype: 'image/png' });
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
    expect(existsSync(path.join(dir, url))).toBe(true);
  });

  it('rejects missing files and non-images', async () => {
    await expect(controller.upload(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.upload({ buffer: Buffer.from('x'), mimetype: 'application/pdf' })).rejects.toThrow(
      'Only JPG, PNG, WebP or GIF pictures are allowed',
    );
  });
});
