/**
 * 领域别名：与 `@diting/plugin-api` 类型一一对应，便于在 core 包内将来抽换实现或加约束。
 */
import { AgentLease, ExecutionRecord, HumanReview, RepairPlan, TitingTask } from "@diting/plugin-api";

export type TaskModel = TitingTask;
export type ExecutionModel = ExecutionRecord;
export type RepairPlanModel = RepairPlan;
export type HumanReviewModel = HumanReview;
export type AgentLeaseModel = AgentLease;
