import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { CreatePlayerRequest, PlayerDto } from '@pop-quiz/shared';
import { PlayersService } from './players.service.js';

@Controller('players')
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Post()
  create(@Body() body: CreatePlayerRequest): Promise<PlayerDto> {
    return this.players.create(body?.username);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<PlayerDto> {
    return this.players.get(id);
  }
}
