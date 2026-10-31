import { Module } from '@nestjs/common';
import { GamesModule } from '../games/games.module.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';
import { QuizzesController } from './quizzes.controller.js';
import { QuizzesService } from './quizzes.service.js';

@Module({
  imports: [GamesModule],
  controllers: [QuizzesController, QuestionsController],
  providers: [QuizzesService, QuestionsService],
})
export class QuizzesModule {}
