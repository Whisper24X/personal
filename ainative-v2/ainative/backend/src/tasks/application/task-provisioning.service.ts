import { Injectable } from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { Task } from '../domain/task';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskCommandService, RemoveTaskOptions } from './task-command.service';

@Injectable()
export class TaskProvisioningService {
  constructor(private readonly taskCommandService: TaskCommandService) {}

  async create(
    createTaskDto: CreateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    return this.taskCommandService.create(createTaskDto, currentUser);
  }

  async remove(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
    options?: RemoveTaskOptions,
  ): Promise<void> {
    await this.taskCommandService.remove(taskId, currentUser, options);
  }
}
