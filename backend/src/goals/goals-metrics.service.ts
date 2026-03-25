import { Injectable } from '@nestjs/common';

/**
 * 需求（Goal）层轻量指标（内存计数，可对接 Prometheus 时替换实现）
 */
@Injectable()
export class GoalsMetricsService {
  goalCreatedTotal = 0;
  goalPrdGenerationTotal = 0;
  goalPrdGenerationFailedTotal = 0;
  goalPlanGenerationTotal = 0;
  goalPlanGenerationFailedTotal = 0;
  goalMaterializedTasksTotal = 0;
  goalApiRequestFailedTotal = 0;

  incrementGoalCreated(): void {
    this.goalCreatedTotal += 1;
  }

  incrementPrdGeneration(ok: boolean): void {
    this.goalPrdGenerationTotal += 1;
    if (!ok) {
      this.goalPrdGenerationFailedTotal += 1;
    }
  }

  incrementPlanGeneration(ok: boolean): void {
    this.goalPlanGenerationTotal += 1;
    if (!ok) {
      this.goalPlanGenerationFailedTotal += 1;
    }
  }

  incrementMaterializedTasks(n: number): void {
    this.goalMaterializedTasksTotal += n;
  }

  incrementApiFailed(): void {
    this.goalApiRequestFailedTotal += 1;
  }

  snapshot(): Record<string, number> {
    return {
      goal_created_total: this.goalCreatedTotal,
      goal_prd_generation_total: this.goalPrdGenerationTotal,
      goal_prd_generation_failed_total: this.goalPrdGenerationFailedTotal,
      goal_plan_generation_total: this.goalPlanGenerationTotal,
      goal_plan_generation_failed_total: this.goalPlanGenerationFailedTotal,
      goal_materialized_tasks_total: this.goalMaterializedTasksTotal,
      goal_api_request_failed_total: this.goalApiRequestFailedTotal,
    };
  }
}
