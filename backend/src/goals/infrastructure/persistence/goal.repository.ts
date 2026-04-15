import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Goal } from '../../domain/goal';
import { GoalPlanItem } from '../../domain/goal-plan-item';
import { GoalPlanSubTask } from '../../domain/goal-plan-sub-task';
import { GoalSourceDoc } from '../../domain/goal-source-doc';
import { TaskDependencyEdge } from '../../domain/task-dependency-edge';
import { GoalStatus } from '../../dto/goal-status.enum';
import { TaskStatus } from '../../../tasks/dto/task-status.enum';

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

  /** 物理删除需求关联的 source_docs / plan_items / plan_sub_tasks（需求软删前调用） */
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

  /** 功能组列表（不含子任务） */
  abstract listPlanItems(goalId: string): Promise<GoalPlanItem[]>;

  /** 功能组 + 嵌套子任务（详情用） */
  abstract listPlanItemsWithSubTasks(goalId: string): Promise<GoalPlanItem[]>;

  abstract replacePlanItems(
    goalId: string,
    items: GoalPlanItem[],
    subTasks: GoalPlanSubTask[],
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

  abstract findPlanSubTask(
    goalId: string,
    subTaskId: string,
  ): Promise<NullableType<GoalPlanSubTask>>;

  abstract updatePlanSubTask(
    goalId: string,
    subTaskId: string,
    payload: Partial<GoalPlanSubTask>,
  ): Promise<NullableType<GoalPlanSubTask>>;

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

  /**
   * 按物化后的 Task ID 同步计划子任务状态：Task 完成则 task_created→completed，否则 completed→task_created。
   */
  abstract syncPlanSubTaskStatusByLinkedTaskId(
    taskId: string,
    isDone: boolean,
  ): Promise<void>;

  /**
   * 删除 Task 前：若仍有「直接依赖本计划子任务、且尚未物化 Task」的后置子任务，则应阻止删除；
   * 若后置功能组（dependsOnItemIds）依赖本组：计划子任务非「分支已合并」时任未物化子任务均拦截；已合并时仅拦截已确认(approved)且仍未物化的后置项；
   * 若无上述子任务级/功能组级后置依赖（叶子），则须计划子任务为「分支已合并」后再删。
   */
  abstract shouldBlockTaskDeletionForPlan(
    taskId: string,
    taskStatus: TaskStatus,
  ): Promise<boolean>;
}
