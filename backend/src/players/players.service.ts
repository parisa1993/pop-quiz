import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PlayerDto, USERNAME_MAX, USERNAME_MIN } from '@pop-quiz/shared';
import { PrismaService } from '../prisma/prisma.service.js';

export function normalizeUsername(raw: unknown): { username: string; key: string } {
  if (typeof raw !== 'string') throw new BadRequestException('Pick a name');
  const username = raw.trim().replace(/\s+/g, ' ');
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    throw new BadRequestException(`Your name needs ${USERNAME_MIN}–${USERNAME_MAX} characters`);
  }
  return { username, key: username.toLocaleLowerCase() };
}

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(rawUsername: unknown): Promise<PlayerDto> {
    const { username, key } = normalizeUsername(rawUsername);
    const taken = await this.prisma.player.findUnique({ where: { usernameKey: key } });
    if (taken) throw new ConflictException(`"${username}" is already taken, try another name`);
    try {
      const player = await this.prisma.player.create({ data: { username, usernameKey: key } });
      return { id: player.id, username: player.username };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(`"${username}" is already taken, try another name`);
      }
      throw error;
    }
  }

  async get(id: string): Promise<PlayerDto> {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    return { id: player.id, username: player.username };
  }
}
