import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Goal 层相关 schema（合并原 GoalLayerSchema / GoalAgentCliColumns /
 * GoalPlanItemWorkflowTemplate / GoalPlanItemGitBaseBranch），须在 InitAinativeSchema 之后执行。
 */
export class GoalSchema1774428115491 implements MigrationInterface {
  name = 'GoalSchema1774428115491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 原 GoalLayerSchema1742850000000 ──
    await queryRunner.query(
      `CREATE TYPE "public"."goal_status_enum" AS ENUM('draft', 'prd_generated', 'prd_confirmed', 'planned', 'in_progress', 'done', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."goal_plan_item_status_enum" AS ENUM('draft', 'approved', 'task_created', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."goal_source_doc_type_enum" AS ENUM('prototype', 'requirement', 'reference')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_dependency_relation_enum" AS ENUM('blocks')`,
    );

    await queryRunner.query(
      `CREATE TABLE "goals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "title" character varying(200) NOT NULL, "summary" text, "status" "public"."goal_status_enum" NOT NULL DEFAULT 'draft', "prdDocPath" character varying(500), "planDocPath" character varying(500), "defaultWorkflowTemplateId" uuid, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_goals" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goals_project_id" ON "goals" ("projectId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goals_status" ON "goals" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goals_created_by" ON "goals" ("createdBy") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "goals" IS 'Goal 目标（大需求规划层）'`,
    );

    await queryRunner.query(`ALTER TABLE "tasks" ADD "goalId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_goal_id" ON "tasks" ("goalId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_goal_id" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "goal_source_docs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "goalId" uuid NOT NULL, "projectDocPath" character varying(500) NOT NULL, "docType" "public"."goal_source_doc_type_enum" NOT NULL, "sortOrder" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_goal_source_docs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_source_docs_goal_id" ON "goal_source_docs" ("goalId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_source_docs" ADD CONSTRAINT "FK_goal_source_docs_goal" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "goal_plan_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "goalId" uuid NOT NULL, "title" character varying(240) NOT NULL, "summary" text, "acceptanceCriteria" text, "suggestedPrompt" text, "dependsOnItemIds" jsonb NOT NULL DEFAULT '[]', "itemOrder" integer NOT NULL DEFAULT 0, "taskId" uuid, "status" "public"."goal_plan_item_status_enum" NOT NULL DEFAULT 'draft', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_goal_plan_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_plan_items_goal_id" ON "goal_plan_items" ("goalId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_plan_items_task_id" ON "goal_plan_items" ("taskId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" ADD CONSTRAINT "FK_goal_plan_items_goal" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" ADD CONSTRAINT "FK_goal_plan_items_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "task_dependencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "predecessorTaskId" uuid NOT NULL, "successorTaskId" uuid NOT NULL, "relationType" "public"."task_dependency_relation_enum" NOT NULL DEFAULT 'blocks', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_task_dependencies" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_dependencies_edge" ON "task_dependencies" ("predecessorTaskId", "successorTaskId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_dependencies_predecessor" ON "task_dependencies" ("predecessorTaskId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_dependencies_successor" ON "task_dependencies" ("successorTaskId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_predecessor" FOREIGN KEY ("predecessorTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_successor" FOREIGN KEY ("successorTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_goals_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ── 原 GoalAgentCliColumns1742860000000 ──
    await queryRunner.query(
      `ALTER TABLE "goals" ADD "agentCliId" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."agentCliId" IS '生成 PRD/拆解计划时默认使用的 Agent CLI 工具 ID'`,
    );
    await queryRunner.query(`ALTER TABLE "goals" ADD "agentCliConfigId" uuid`);
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."agentCliConfigId" IS '生成 PRD/拆解计划时默认使用的业务线 Agent 工具配置 ID'`,
    );

    // ── 原 GoalPlanItemWorkflowTemplate1742870000000 ──
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" ADD "workflowTemplateId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goal_plan_items"."workflowTemplateId" IS '物化该计划项时使用的项目工作流模板 ID'`,
    );

    // ── 原 GoalPlanItemGitBaseBranch1742880000000 ──
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" ADD "gitBaseBranch" character varying(120)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goal_plan_items"."gitBaseBranch" IS '物化任务时使用的 Git 基准分支（与 CreateTaskDto.gitBaseBranch 一致）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP COLUMN "gitBaseBranch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP COLUMN "workflowTemplateId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP COLUMN "agentCliConfigId"`,
    );
    await queryRunner.query(`ALTER TABLE "goals" DROP COLUMN "agentCliId"`);

    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_goals_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_task_dependencies_successor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_task_dependencies_predecessor"`,
    );
    await queryRunner.query(`DROP TABLE "task_dependencies"`);
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP CONSTRAINT "FK_goal_plan_items_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP CONSTRAINT "FK_goal_plan_items_goal"`,
    );
    await queryRunner.query(`DROP TABLE "goal_plan_items"`);
    await queryRunner.query(
      `ALTER TABLE "goal_source_docs" DROP CONSTRAINT "FK_goal_source_docs_goal"`,
    );
    await queryRunner.query(`DROP TABLE "goal_source_docs"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_goal_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_goal_id"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "goalId"`);
    await queryRunner.query(`DROP TABLE "goals"`);
    await queryRunner.query(
      `DROP TYPE "public"."task_dependency_relation_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."goal_source_doc_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."goal_plan_item_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."goal_status_enum"`);
  }
}
