import { DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig, type AppConfig } from './config.js';

@Module({})
export class AppConfigModule {
  static forRoot(config: AppConfig = loadConfig()): DynamicModule {
    return {
      module: AppConfigModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
