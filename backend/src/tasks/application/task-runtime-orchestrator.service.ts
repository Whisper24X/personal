import { Injectable } from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../../projects/projects.service';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskLogService } from './task-log.service';

type TaskRuntimeSnapshot = {
  gitBranch: string;
  gitBaseBranch: string;
  worktreePath: string;
};

@Injectable()
export class TaskRuntimeOrchestratorService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly taskRepository: TaskRepository,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly taskLogService: TaskLogService,
  ) {}

  async prepareTaskRuntime(
    task: Task,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; project: Project }> {
    const project = await this.projectsService.assertProjectCapability(
      task.projectId,
      currentUser,
      'project.task.read',
    );

    const initializedRuntime = await this.initializeTaskRuntime(task, project);

    return {
      task: this.createRuntimeTaskSnapshot(
        initializedRuntime.task,
        initializedRuntime.runtime,
      ),
      project,
    };
  }

  async initializeTaskRuntime(
    task: Task,
    project: Project,
    options?: { forceLog?: boolean },
  ): Promise<{
    task: Task;
    runtime: TaskRuntimeSnapshot;
  }> {
    const runtime = await this.taskRuntimeService.ensureRuntime(task, project);

    const hasRuntimeChanged =
      task.gitBranch !== runtime.gitBranch ||
      task.gitBaseBranch !== runtime.gitBaseBranch ||
      task.gitWorktree !== runtime.gitWorktree;

    const runtimeTask = hasRuntimeChanged
      ? ((await this.taskRepository.update(task.id, {
          gitBranch: runtime.gitBranch,
          gitBaseBranch: runtime.gitBaseBranch,
          gitWorktree: runtime.gitWorktree,
        })) ?? task)
      : task;

    if (options?.forceLog || hasRuntimeChanged) {
      await this.taskLogService.appendLog({
        taskId: task.id,
        taskNodeId: null,
        level: TaskLogLevel.info,
        message: 'Task sandbox initialized',
        payload: {
          gitBranch: runtime.gitBranch,
          gitBaseBranch: runtime.gitBaseBranch,
          gitWorktree: runtime.gitWorktree,
          worktreePath: runtime.worktreePath,
        },
      });
    }

    return {
      task: runtimeTask,
      runtime,
    };
  }

  createRuntimeTaskSnapshot(task: Task, runtime: TaskRuntimeSnapshot): Task {
    return {
      ...task,
      gitBranch: runtime.gitBranch,
      gitBaseBranch: runtime.gitBaseBranch,
      gitWorktree: runtime.worktreePath,
    };
  }
}
