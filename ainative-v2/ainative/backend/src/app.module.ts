import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { HomeModule } from './home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { BusinessLinesModule } from './business-lines/business-lines.module';
import { ProjectsModule } from './projects/projects.module';
import { WorkflowTemplatesModule } from './workflow-templates/workflow-templates.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SkillsModule } from './skills/skills.module';
import { McpsModule } from './mcps/mcps.module';
import { QueueModule } from './queue/queue.module';
import { ObservabilityModule } from './observability/observability.module';
import { ProjectContextModule } from './project-context/project-context.module';
import { AutomationsModule } from './automations/automations.module';
import { GitModule } from './git/git.module';
import { GoalsModule } from './goals/goals.module';
import { MemoryModule } from './memory/memory.module';
import { resolveEnvFilePath } from './config/env-file-path';
import { existsSync } from 'fs';
import { LocalizedHttpExceptionFilter } from './utils/localized-http-exception.filter';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

function resolveI18nPath(): string {
  const candidates = [
    path.join(__dirname, 'i18n'),
    path.join(__dirname, '..', 'i18n'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, appConfig],
      envFilePath: resolveEnvFilePath(),
    }),
    BusinessLinesModule,
    ProjectsModule,
    WorkflowTemplatesModule,
    TasksModule,
    GoalsModule,
    MemoryModule,
    NotificationsModule,
    SkillsModule,
    McpsModule,
    QueueModule,
    ObservabilityModule,
    ProjectContextModule,
    AutomationsModule,
    GitModule,
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: resolveI18nPath(), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    HomeModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: LocalizedHttpExceptionFilter,
    },
  ],
})
export class AppModule {}
