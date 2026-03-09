import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRepository } from '../task.repository';
import { TaskNodeRepository } from '../task-node.repository';
import { TaskLogRepository } from '../task-log.repository';
import { TaskArtifactRepository } from '../task-artifact.repository';
import { TaskEntity } from './entities/task.entity';
import { TaskNodeEntity } from './entities/task-node.entity';
import { TaskRelationalRepository } from './repositories/task.repository';
import { TaskNodeRelationalRepository } from './repositories/task-node.repository';
import { TaskLogFileRepository } from '../file/repositories/task-log.repository';
import { TaskArtifactFileRepository } from '../file/repositories/task-artifact.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, TaskNodeEntity])],
  providers: [
    {
      provide: TaskRepository,
      useClass: TaskRelationalRepository,
    },
    {
      provide: TaskNodeRepository,
      useClass: TaskNodeRelationalRepository,
    },
    {
      provide: TaskLogRepository,
      useClass: TaskLogFileRepository,
    },
    {
      provide: TaskArtifactRepository,
      useClass: TaskArtifactFileRepository,
    },
  ],
  exports: [
    TaskRepository,
    TaskNodeRepository,
    TaskLogRepository,
    TaskArtifactRepository,
  ],
})
export class RelationalTaskPersistenceModule {}
