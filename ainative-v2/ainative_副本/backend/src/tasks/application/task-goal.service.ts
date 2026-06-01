import { Injectable } from '@nestjs/common';
import { GoalRepository } from '../../goals/infrastructure/persistence/goal.repository';
import { GoalStatus } from '../../goals/dto/goal-status.enum';
import { ProjectAccessService } from '../../projects/project-access.service';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { TaskStatus } from '../dto/task-status.enum';

@Injectable()
export class TaskGoalService {
  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async getGoalSummary(
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ id: string; title: string; status: GoalStatus } | null> {
    const goal = await this.goalRepository.findById(goalId);

    if (!goal) {
      return null;
    }

    await this.projectAccessService.assertProjectCapability(
      goal.projectId,
      currentUser,
      'project.task.read',
    );

    return {
      id: goal.id,
      title: goal.title,
      status: goal.status,
    };
  }

  async syncPlanSubTaskStatusFromTask(
    taskId: string,
    taskStatus: TaskStatus,
  ): Promise<void> {
    await this.goalRepository.syncPlanSubTaskStatusByLinkedTaskId(
      taskId,
      taskStatus === TaskStatus.done,
    );
  }
}
