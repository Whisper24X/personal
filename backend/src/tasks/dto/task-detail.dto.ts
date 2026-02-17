import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';

export class TaskDetailDto {
  @ApiProperty({ type: Task })
  task: Task;

  @ApiProperty({ type: TaskNode, isArray: true })
  nodes: TaskNode[];
}
