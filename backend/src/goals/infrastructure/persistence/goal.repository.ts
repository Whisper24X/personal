import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Goal } from '../../domain/goal';
import { GoalPlanItem } from '../../domain/goal-plan-item';
import { GoalSourceDoc } from '../../domain/goal-source-doc';
import { TaskDependencyEdge } from '../../domain/task-dependency-edge';
import { GoalStatus } from '../../dto/goal-status.enum';

export abstract class GoalRepository {
  abstract create(
    data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
      id?: string;
    },
  ): Promise<Goal>;

  abstract findById(id: Goal['id']): Promise<NullableType<Goal>>;

  abstract update(
    id: Goal['id'],
    payload: Partial<Goal>,
  ): Promise<NullableType<Goal>>;

  abstract softRemove(id: Goal['id']): Promise<void>;

  /** 物理删除需求关联的 source_docs / plan_items（需求软删前调用） */
  abstract deleteSourceDocsAndPlanItemsByGoalId(goalId: string): Promise<void>;

  abstract findMany(params: {
    paginationOptions: IPaginationOptions;
    projectId: string;
    status?: GoalStatus;
    titleContains?: string;
    createdBy?: string;
  }): Promise<Goal[]>;

  abstract listSourceDocs(goalId: string): Promise<GoalSourceDoc[]>;

  abstract insertSourceDoc(
    data: Omit<GoalSourceDoc, 'id' | 'createdAt'> & { id?: string },
  ): Promise<GoalSourceDoc>;

  abstract removeSourceDoc(id: string, goalId: string): Promise<void>;

  abstract listPlanItems(goalId: string): Promise<GoalPlanItem[]>;

  abstract replacePlanItems(
    goalId: string,
    items: GoalPlanItem[],
  ): Promise<void>;

  abstract updatePlanItem(
    goalId: string,
    itemId: string,
    payload: Partial<GoalPlanItem>,
  ): Promise<NullableType<GoalPlanItem>>;

  abstract findPlanItem(
    goalId: string,
    itemId: string,
  ): Promise<NullableType<GoalPlanItem>>;

  abstract listTaskDependenciesForGoal(
    goalId: string,
  ): Promise<TaskDependencyEdge[]>;

  abstract replaceTaskDependenciesForGoal(
    goalId: string,
    edges: Array<
      Pick<TaskDependencyEdge, 'predecessorTaskId' | 'successorTaskId'>
    >,
  ): Promise<void>;

  abstract insertTaskDependency(
    data: Omit<TaskDependencyEdge, 'id' | 'createdAt'> & { id?: string },
  ): Promise<TaskDependencyEdge>;

  abstract removeTaskDependency(id: string): Promise<void>;
}
