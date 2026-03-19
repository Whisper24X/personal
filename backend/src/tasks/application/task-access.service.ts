import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../../projects/projects.service';
import { Project } from '../../projects/domain/project';
import { ProjectRepository } from '../../projects/infrastructure/persistence/project.repository';
import { Task } from '../domain/task';
import { TaskRepository } from '../infrastructure/persistence/task.repository';

@Injectable()
export class TaskAccessService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async assertCanAccessTask(
    taskId: string,
    currentUser: JwtPayloadType,
    capability = 'project.task.read',
  ): Promise<Task> {
    return this.getTaskOrThrow(taskId, currentUser, capability);
  }

  async assertCanAccessTaskProject(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; project: Project }> {
    const task = await this.getTaskOrThrow(taskId, currentUser);
    const project = await this.getProjectByIdOrThrow(task.projectId);

    return {
      task,
      project,
    };
  }

  async getTaskOrThrow(
    taskId: string,
    currentUser: JwtPayloadType,
    capability = 'project.task.read',
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.projectsService.assertProjectCapability(
      task.projectId,
      currentUser,
      capability,
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
}
