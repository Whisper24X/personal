import { NullableType } from '../../../utils/types/nullable.type';
import { TaskNode } from '../../domain/task-node';
import { TaskNodeStatus } from '../../dto/task-node-status.enum';

export abstract class TaskNodeRepository {
  abstract createMany(
    data: Array<Omit<TaskNode, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<TaskNode[]>;

  abstract findByTaskId(taskId: TaskNode['taskId']): Promise<TaskNode[]>;

  abstract findById(id: TaskNode['id']): Promise<NullableType<TaskNode>>;

  abstract findInProgressByTaskId(
    taskId: TaskNode['taskId'],
  ): Promise<NullableType<TaskNode>>;

  abstract findFirstByTaskIdAndStatus({
    taskId,
    status,
  }: {
    taskId: TaskNode['taskId'];
    status: TaskNodeStatus;
  }): Promise<NullableType<TaskNode>>;

  abstract findByTaskIdAndStatus({
    taskId,
    status,
  }: {
    taskId: TaskNode['taskId'];
    status: TaskNodeStatus;
  }): Promise<TaskNode[]>;

  abstract claimFirstTodoNode(
    taskId: TaskNode['taskId'],
    workerId: string,
    leaseUntil: Date,
  ): Promise<NullableType<TaskNode>>;

  abstract renewNodeLease({
    nodeId,
    workerId,
    leaseUntil,
    heartbeatAt,
  }: {
    nodeId: TaskNode['id'];
    workerId: string;
    leaseUntil: Date;
    heartbeatAt: Date;
  }): Promise<boolean>;

  abstract releaseNodeLease(nodeId: TaskNode['id']): Promise<void>;

  abstract findExpiredInProgressNodes({
    now,
    limit,
  }: {
    now: Date;
    limit: number;
  }): Promise<TaskNode[]>;

  abstract update(
    id: TaskNode['id'],
    payload: Partial<TaskNode>,
  ): Promise<NullableType<TaskNode>>;
}
