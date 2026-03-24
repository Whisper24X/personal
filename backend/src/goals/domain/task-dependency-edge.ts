import { ApiProperty } from '@nestjs/swagger';
import { TaskDependencyRelation } from '../dto/task-dependency-relation.enum';

export class TaskDependencyEdge {
  @ApiProperty()
  id: string;

  @ApiProperty()
  predecessorTaskId: string;

  @ApiProperty()
  successorTaskId: string;

  @ApiProperty({ enum: TaskDependencyRelation, enumName: 'TaskDependencyRelation' })
  relationType: TaskDependencyRelation;

  @ApiProperty()
  createdAt: Date;
}
