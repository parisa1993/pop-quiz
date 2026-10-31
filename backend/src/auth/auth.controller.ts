import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { AdminLoginRequest, AdminLoginResponse } from '@pop-quiz/shared';
import { AuthService } from './auth.service.js';

@Controller('admin')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: AdminLoginRequest): Promise<AdminLoginResponse> {
    return { token: await this.auth.login(body?.password) };
  }
}
