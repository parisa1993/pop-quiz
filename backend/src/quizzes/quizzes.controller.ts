import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { QuizDetail, QuizInput, QuizSummary } from '@pop-quiz/shared';
import { AdminGuard } from '../auth/admin.guard.js';
import { QuizzesService } from './quizzes.service.js';

@Controller('admin/quizzes')
@UseGuards(AdminGuard)
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  list(): Promise<QuizSummary[]> {
    return this.quizzes.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<QuizDetail> {
    return this.quizzes.get(id);
  }

  @Post()
  create(@Body() body: QuizInput): Promise<QuizDetail> {
    return this.quizzes.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<QuizInput>): Promise<QuizDetail> {
    return this.quizzes.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.quizzes.remove(id);
  }
}
