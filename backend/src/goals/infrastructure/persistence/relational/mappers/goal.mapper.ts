import { Goal } from '../../../../domain/goal';
import { GoalSourceDoc } from '../../../../domain/goal-source-doc';
import { GoalPlanItem } from '../../../../domain/goal-plan-item';
import { GoalPlanSubTask } from '../../../../domain/goal-plan-sub-task';
import { TaskDependencyEdge } from '../../../../domain/task-dependency-edge';
import { GoalEntity } from '../entities/goal.entity';
import { GoalSourceDocEntity } from '../entities/goal-source-doc.entity';
import { GoalPlanItemEntity } from '../entities/goal-plan-item.entity';
import { GoalPlanSubTaskEntity } from '../entities/goal-plan-sub-task.entity';
import { TaskDependencyEntity } from '../entities/task-dependency.entity';

export class GoalMapper {
  static goalToDomain(raw: GoalEntity): Goal {
    const g = new Goal();
    g.id = raw.id;
    g.projectId = raw.projectId;
    g.title = raw.title;
    g.summary = raw.summary ?? null;
    g.status = raw.status;
    g.prdDocPath = raw.prdDocPath ?? null;
    g.planDocPath = raw.planDocPath ?? null;
    g.defaultWorkflowTemplateId = raw.defaultWorkflowTemplateId ?? null;
    g.agentCliId = raw.agentCliId ?? null;
    g.agentCliConfigId = raw.agentCliConfigId ?? null;
    g.gitBaseBranch = raw.gitBaseBranch;
    g.gitBranch = raw.gitBranch;
    g.createdBy = raw.createdBy ?? null;
    g.createdAt = raw.createdAt;
    g.updatedAt = raw.updatedAt;
    g.deletedAt = raw.deletedAt ?? null;
    return g;
  }

  static goalToPersistence(domain: Goal): GoalEntity {
    const e = new GoalEntity();
    if (domain.id) {
      e.id = domain.id;
    }
    e.projectId = domain.projectId;
    e.title = domain.title;
    e.summary = domain.summary ?? null;
    e.status = domain.status;
    e.prdDocPath = domain.prdDocPath ?? null;
    e.planDocPath = domain.planDocPath ?? null;
    e.defaultWorkflowTemplateId = domain.defaultWorkflowTemplateId ?? null;
    e.agentCliId = domain.agentCliId ?? null;
    e.agentCliConfigId = domain.agentCliConfigId ?? null;
    e.gitBaseBranch = domain.gitBaseBranch;
    e.gitBranch = domain.gitBranch;
    e.createdBy = domain.createdBy ?? null;
    e.createdAt = domain.createdAt;
    e.updatedAt = domain.updatedAt;
    e.deletedAt = domain.deletedAt ?? null;
    return e;
  }

  static sourceDocToDomain(raw: GoalSourceDocEntity): GoalSourceDoc {
    const d = new GoalSourceDoc();
    d.id = raw.id;
    d.goalId = raw.goalId;
    d.projectDocPath = raw.projectDocPath;
    d.docType = raw.docType;
    d.sortOrder = raw.sortOrder;
    d.createdAt = raw.createdAt;
    return d;
  }

  static planItemToDomain(raw: GoalPlanItemEntity): GoalPlanItem {
    const p = new GoalPlanItem();
    p.id = raw.id;
    p.goalId = raw.goalId;
    p.title = raw.title;
    p.summary = raw.summary ?? null;
    p.acceptanceCriteria = raw.acceptanceCriteria ?? null;
    p.suggestedPrompt = raw.suggestedPrompt ?? null;
    p.dependsOnItemIds = Array.isArray(raw.dependsOnItemIds)
      ? raw.dependsOnItemIds
      : [];
    p.itemOrder = raw.itemOrder;
    p.gitBranch = raw.gitBranch ?? null;
    p.createdAt = raw.createdAt;
    p.updatedAt = raw.updatedAt;
    return p;
  }

  static planSubTaskToDomain(raw: GoalPlanSubTaskEntity): GoalPlanSubTask {
    const s = new GoalPlanSubTask();
    s.id = raw.id;
    s.goalPlanItemId = raw.goalPlanItemId;
    s.title = raw.title;
    s.summary = raw.summary ?? null;
    s.acceptanceCriteria = raw.acceptanceCriteria ?? null;
    s.suggestedPrompt = raw.suggestedPrompt ?? null;
    s.dependsOnSubTaskIds = Array.isArray(raw.dependsOnSubTaskIds)
      ? raw.dependsOnSubTaskIds
      : [];
    s.itemOrder = raw.itemOrder;
    s.taskId = raw.taskId ?? null;
    s.status = raw.status;
    s.workflowTemplateId = raw.workflowTemplateId ?? null;
    s.createdAt = raw.createdAt;
    s.updatedAt = raw.updatedAt;
    return s;
  }

  static dependencyToDomain(raw: TaskDependencyEntity): TaskDependencyEdge {
    const t = new TaskDependencyEdge();
    t.id = raw.id;
    t.predecessorTaskId = raw.predecessorTaskId;
    t.successorTaskId = raw.successorTaskId;
    t.relationType = raw.relationType;
    t.createdAt = raw.createdAt;
    return t;
  }
}
