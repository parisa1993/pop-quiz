import { Body, Controller, Delete, HttpCode, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import type { Question, QuestionInput, ReorderQuestionsRequest } from '@pop-quiz/shared';
import { AdminGuard } from '../auth/admin.guard.js';
import { QuestionsService } from './questions.service.js';

@Controller('admin')
@UseGuards(AdminGuard)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Post('quizzes/:quizId/questions')
  create(@Param('quizId') quizId: string, @Body() body: QuestionInput): Promise<Question> {
    return this.questions.create(quizId, body);
  }

  @Put('quizzes/:quizId/questions/order')
  reorder(@Param('quizId') quizId: string, @Body() body: ReorderQuestionsRequest): Promise<Question[]> {
    return this.questions.reorder(quizId, body?.ids);
  }

  @Patch('questions/:id')
  update(@Param('id') id: string, @Body() body: QuestionInput): Promise<Question> {
    return this.questions.update(id, body);
  }

  @Delete('questions/:id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.questions.remove(id);
  }
}
