import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { TaskArtifact } from '../../../../domain/task-artifact';
import { TaskArtifactRepository } from '../../task-artifact.repository';
import { TaskArtifactEntity } from '../entities/task-artifact.entity';
import { TaskArtifactMapper } from '../mappers/task-artifact.mapper';

@Injectable()
export class TaskArtifactRelationalRepository
  implements TaskArtifactRepository
{
  constructor(
    @InjectRepository(TaskArtifactEntity)
    private readonly taskArtifactRepository: Repository<TaskArtifactEntity>,
  ) {}

  async create(
    data: Omit<TaskArtifact, 'id' | 'createdAt'>,
  ): Promise<TaskArtifact> {
    const entity = await this.taskArtifactRepository.save(
      this.taskArtifactRepository.create({
        taskId: data.taskId,
        taskNodeId: data.taskNodeId,
        artifactType: data.artifactType,
        name: data.name,
        downloadUrl: data.downloadUrl,
        content: data.content,
        metadata: data.metadata,
      }),
    );

    return TaskArtifactMapper.toDomain(entity);
  }

  async findByTaskId(taskId: TaskArtifact['taskId']): Promise<TaskArtifact[]> {
    const entities = await this.taskArtifactRepository.find({
      where: { taskId },
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => TaskArtifactMapper.toDomain(entity));
  }

  async findById(id: TaskArtifact['id']): Promise<NullableType<TaskArtifact>> {
    const entity = await this.taskArtifactRepository.findOne({
      where: { id },
    });

    return entity ? TaskArtifactMapper.toDomain(entity) : null;
  }
}
