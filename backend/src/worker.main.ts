import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  if (!process.env.AINATIVE_RUNTIME_ROLE) {
    process.env.AINATIVE_RUNTIME_ROLE = 'worker';
  }

  const logger = new Logger('AINativeWorker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  logger.log(
    `Worker started (role=${process.env.AINATIVE_RUNTIME_ROLE ?? 'worker'})`,
  );

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker...`);
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap();
