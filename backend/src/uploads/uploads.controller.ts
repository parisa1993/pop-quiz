import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadResponse } from '@pop-quiz/shared';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AdminGuard } from '../auth/admin.guard.js';
import { APP_CONFIG, type AppConfig } from '../config.js';

/** The parts of a multer file we use. */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Controller('admin/uploads')
@UseGuards(AdminGuard)
export class UploadsController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file: UploadedImage | undefined): Promise<UploadResponse> {
    if (!file) throw new BadRequestException('Choose a picture to upload');
    const extension = IMAGE_EXTENSIONS[file.mimetype];
    if (!extension) throw new BadRequestException('Only JPG, PNG, WebP or GIF pictures are allowed');

    await mkdir(this.config.uploadsDir, { recursive: true });
    const name = `${randomUUID()}${extension}`;
    await writeFile(path.join(this.config.uploadsDir, name), file.buffer);
    return { url: `/uploads/${name}` };
  }
}
