import { Module } from '@nestjs/common';
import { GitModule } from '../git/git.module';
import { McpsController } from './mcps.controller';
import { McpsService } from './mcps.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule, GitModule],
  controllers: [McpsController],
  providers: [McpsService],
  exports: [McpsService],
})
export class McpsModule {}
