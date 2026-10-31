import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../config.js';

const ADMIN_ROLE = 'admin';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(password: unknown): Promise<string> {
    if (typeof password !== 'string' || !this.passwordMatches(password)) {
      throw new UnauthorizedException('Wrong password');
    }
    return this.jwt.signAsync(
      { role: ADMIN_ROLE },
      { secret: this.config.jwtSecret, expiresIn: '7d' },
    );
  }

  async isAdminToken(token: unknown): Promise<boolean> {
    if (typeof token !== 'string' || !token) return false;
    try {
      const payload = await this.jwt.verifyAsync<{ role?: string }>(token, {
        secret: this.config.jwtSecret,
      });
      return payload.role === ADMIN_ROLE;
    } catch {
      return false;
    }
  }

  private passwordMatches(password: string): boolean {
    const given = Buffer.from(password);
    const expected = Buffer.from(this.config.adminPassword);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
