import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { UserSeedService } from './user/user-seed.service';
import { BusinessLineSeedService } from './business-line/business-line-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  // run
  await app.get(UserSeedService).run();
  await app.get(BusinessLineSeedService).run();

  await app.close();
};

void runSeed();
