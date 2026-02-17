import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRepository } from '../task.repository';
import { TaskNodeRepository } from '../task-node.repository';
import { TaskLogRepository } from '../task-log.repository';
import { TaskArtifactRepository } from '../task-artifact.repository';
import { TaskEntity } from './entities/task.entity';
import { TaskNodeEntity } from './entities/task-node.entity';
import { TaskLogEntity } from './entities/task-log.entity';
import { TaskArtifactEntity } from './entities/task-artifact.entity';
import { TaskRelationalRepository } from './repositories/task.repository';
import { TaskNodeRelationalRepository } from './repositories/task-node.repository';
import { TaskLogRelationalRepository } from './repositories/task-log.repository';
import { TaskArtifactRelationalRepository } from './repositories/task-artifact.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskNodeEntity,
      TaskLogEntity,
      TaskArtifactEntity,
    ]),
  ],
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
      useClass: TaskLogRelationalRepository,
    },
    {
      provide: TaskArtifactRepository,
      useClass: TaskArtifactRelationalRepository,
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
