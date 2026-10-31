import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { AuthModule } from './auth/auth.module.js';
import { loadConfig, type AppConfig } from './config.js';
import { AppConfigModule } from './config.module.js';
import { GamesModule } from './games/games.module.js';
import { PlayersModule } from './players/players.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QuizzesModule } from './quizzes/quizzes.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig = loadConfig()): DynamicModule {
    // In production the built Angular app is served from the same port as the API.
    const frontend = existsSync(config.frontendDist)
      ? [
          ServeStaticModule.forRoot({
            rootPath: config.frontendDist,
            exclude: ['/api/{*path}', '/uploads/{*path}', '/socket.io/{*path}'],
          }),
        ]
      : [];

    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(config),
        PrismaModule,
        AuthModule,
        GamesModule,
        QuizzesModule,
        PlayersModule,
        UploadsModule,
        ...frontend,
      ],
    };
  }
}
