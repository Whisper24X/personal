import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { RepositoryDiagnosticsOptions } from '../../../observability/repository-diagnostics';
import { Task } from '../../domain/task';
import { TaskStatus } from '../../dto/task-status.enum';

export abstract class TaskRepository {
  abstract create(
    data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Task>;

  abstract findById(
    id: Task['id'],
    options?: RepositoryDiagnosticsOptions,
  ): Promise<NullableType<Task>>;

  abstract findByGoalId(goalId: string): Promise<Task[]>;

  abstract findByGitWorktree(gitWorktree: string): Promise<NullableType<Task>>;

  abstract findMaxGitWorktreeSequence(prefix: string): Promise<number>;

  abstract bulkUpdateBusinessLineIdByProjectId(params: {
    projectId: string;
    businessLineId: string;
  }): Promise<void>;

  abstract findAllWithPagination({
    paginationOptions,
    projectId,
    status,
  }: {
    paginationOptions: IPaginationOptions;
    projectId?: string;
    status?: TaskStatus;
  }): Promise<Task[]>;

  /** 按状态分组计数（未删除、指定项目） */
  abstract countByStatusForProject(
    projectId: string,
  ): Promise<Record<TaskStatus, number>>;

  abstract countRunningTasks(at?: Date): Promise<number>;

  abstract countRunningTasksByProjectIds(
    projectIds: string[],
    at?: Date,
  ): Promise<Record<string, number>>;

  abstract hasRunningTaskInProject(
    projectId: string,
    options?: {
      excludeTaskId?: Task['id'];
      at?: Date;
    },
  ): Promise<boolean>;

  abstract countQueuedTasksByProjectIds(
    projectIds: string[],
    at?: Date,
  ): Promise<Record<string, number>>;

  abstract countStaleRunningTasks(at?: Date): Promise<number>;

  abstract findOldestQueuedTaskCreatedAt(at?: Date): Promise<Date | null>;

  abstract findTasksReadyForDispatch(limit: number, at?: Date): Promise<Task[]>;

  abstract findTasksWithExpiredWorktrees(
    limit: number,
    at?: Date,
  ): Promise<Task[]>;

  abstract update(
    id: Task['id'],
    payload: Partial<Task>,
  ): Promise<NullableType<Task>>;

  /**
   * Atomically acquire a git operation lock.
   * Sets configJson.gitOperation to the provided value ONLY IF no operation
   * is currently running. Returns true if acquired, false if already locked.
   */
  abstract acquireGitOperationLock(
    id: Task['id'],
    gitOperation: Record<string, unknown>,
  ): Promise<boolean>;

  abstract remove(id: Task['id']): Promise<void>;
}
