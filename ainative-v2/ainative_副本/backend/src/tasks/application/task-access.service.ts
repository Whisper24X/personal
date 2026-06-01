import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ProjectAccessService } from '../../projects/project-access.service';
import { Project } from '../../projects/domain/project';
import { ProjectRepository } from '../../projects/infrastructure/persistence/project.repository';
import { SlowApiDiagnosticsSession } from '../../observability/slow-api-diagnostics';
import { Task } from '../domain/task';
import { TaskRepository } from '../infrastructure/persistence/task.repository';

@Injectable()
export class TaskAccessService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async assertCanAccessTask(
    taskId: string,
    currentUser: JwtPayloadType,
    capability = 'project.task.read',
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<Task> {
    return this.getTaskOrThrow(taskId, currentUser, capability, diagnostics);
  }

  async assertCanAccessTaskProject(
    taskId: string,
    currentUser: JwtPayloadType,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<{ task: Task; project: Project }> {
    const task = await this.getTaskByIdOrThrowWithDiagnostics(
      taskId,
      'project.task.read',
      diagnostics,
    );
    const project = await this.assertTaskProjectCapability(
      task,
      currentUser,
      'project.task.read',
      diagnostics,
    );

    return {
      task,
      project,
    };
  }

  async getTaskOrThrow(
    taskId: string,
    currentUser: JwtPayloadType,
    capability = 'project.task.read',
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<Task> {
    const task = await this.getTaskByIdOrThrowWithDiagnostics(
      taskId,
      capability,
      diagnostics,
    );
    await this.assertTaskProjectCapability(
      task,
      currentUser,
      capability,
      diagnostics,
    );

    return task;
  }

  async getTaskByIdOrThrow(taskId: string): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async getProjectByIdOrThrow(projectId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  ensureAdmin(currentUser: JwtPayloadType): void {
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException('ProjectId is required for non-admin users');
    }
  }

  isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async getTaskByIdOrThrowWithDiagnostics(
    taskId: string,
    capability: string,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<Task> {
    const task = diagnostics
      ? await diagnostics.measure(
          'taskLookup',
          () =>
            this.taskRepository.findById(taskId, {
              diagnostics,
              metricPrefix: 'taskLookup',
            }),
          (result) => ({
            taskFound: Boolean(result),
            taskProjectId: result?.projectId ?? null,
            accessCapability: capability,
          }),
        )
      : await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private async assertTaskProjectCapability(
    task: Task,
    currentUser: JwtPayloadType,
    capability: string,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<Project> {
    if (diagnostics) {
      return diagnostics.measure(
        'projectCapability',
        () =>
          this.projectAccessService.assertProjectCapability(
            task.projectId,
            currentUser,
            capability,
            diagnostics,
          ),
        (result) => ({
          projectId: result.id,
          projectBusinessLineId: result.businessLineId,
        }),
      );
    }

    return this.projectAccessService.assertProjectCapability(
      task.projectId,
      currentUser,
      capability,
    );
  }
}
