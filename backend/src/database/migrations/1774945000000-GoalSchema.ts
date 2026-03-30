import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Goal 层 schema（含 Agent CLI、功能组工作流与 Git、子任务表 goal_plan_sub_tasks、
 * Goal 与功能组 Git 分支列；功能组分支可延后创建故 gitBranch 可为空）。
 * 须在 InitAinativeSchema 之后执行。
 */
export class GoalSchema1774945000000 implements MigrationInterface {
  name = 'GoalSchema1774945000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."goal_status_enum" AS ENUM('draft', 'prd_generated', 'prd_confirmed', 'planned', 'in_progress', 'done', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."goal_plan_item_status_enum" AS ENUM('draft', 'approved', 'task_created', 'cancelled', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."goal_source_doc_type_enum" AS ENUM('prototype', 'requirement', 'reference')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_dependency_relation_enum" AS ENUM('blocks')`,
    );

    await queryRunner.query(
      `CREATE TABLE "goals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "title" character varying(200) NOT NULL, "summary" text, "status" "public"."goal_status_enum" NOT NULL DEFAULT 'draft', "prdDocPath" character varying(500), "planDocPath" character varying(500), "defaultWorkflowTemplateId" uuid, "agentCliId" character varying(64), "agentCliConfigId" uuid, "createdBy" uuid, "gitBaseBranch" character varying(255) NOT NULL, "gitBranch" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_goals" PRIMARY KEY ("id"))`,
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
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."agentCliId" IS '生成 PRD/拆解计划时默认使用的 Agent CLI 工具 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."agentCliConfigId" IS '生成 PRD/拆解计划时默认使用的业务线 Agent 工具配置 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."gitBaseBranch" IS '创建需求时用户选择的 Git 基准分支'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."gitBranch" IS '为本需求在仓库中创建的需求分支名'`,
    );

    await queryRunner.query(`ALTER TABLE "tasks" ADD "goalId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_goal_id" ON "tasks" ("goalId") `,
    );

    await queryRunner.query(
      `CREATE TABLE "goal_source_docs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "goalId" uuid NOT NULL, "projectDocPath" character varying(500) NOT NULL, "docType" "public"."goal_source_doc_type_enum" NOT NULL, "sortOrder" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_goal_source_docs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_source_docs_goal_id" ON "goal_source_docs" ("goalId") `,
    );

    await queryRunner.query(
      `CREATE TABLE "goal_plan_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "goalId" uuid NOT NULL, "title" character varying(240) NOT NULL, "summary" text, "acceptanceCriteria" text, "suggestedPrompt" text, "dependsOnItemIds" jsonb NOT NULL DEFAULT '[]', "itemOrder" integer NOT NULL DEFAULT 0, "gitBranch" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_goal_plan_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_plan_items_goal_id" ON "goal_plan_items" ("goalId") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "goal_plan_items" IS '任务计划功能组（父级，不物化为 Task）'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goal_plan_items"."gitBranch" IS '该功能组对应的 Git 分支名'`,
    );

    await queryRunner.query(
      `CREATE TABLE "goal_plan_sub_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "goalPlanItemId" uuid NOT NULL, "title" character varying(240) NOT NULL, "summary" text, "acceptanceCriteria" text, "suggestedPrompt" text, "dependsOnSubTaskIds" jsonb NOT NULL DEFAULT '[]', "itemOrder" integer NOT NULL DEFAULT 0, "taskId" uuid, "status" "public"."goal_plan_item_status_enum" NOT NULL DEFAULT 'draft', "workflowTemplateId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_goal_plan_sub_tasks" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_plan_sub_tasks_goal_plan_item_id" ON "goal_plan_sub_tasks" ("goalPlanItemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_plan_sub_tasks_task_id" ON "goal_plan_sub_tasks" ("taskId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "goal_plan_sub_tasks" IS '任务计划子任务（唯一可物化为 Task 的单元）'`,
    );

    await queryRunner.query(
      `CREATE TABLE "task_dependencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "predecessorTaskId" uuid NOT NULL, "successorTaskId" uuid NOT NULL, "relationType" "public"."task_dependency_relation_enum" NOT NULL DEFAULT 'blocks', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_task_dependencies" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_dependencies_edge" ON "task_dependencies" ("predecessorTaskId", "successorTaskId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_dependencies_successor" ON "task_dependencies" ("successorTaskId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "FK_goals_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT IF EXISTS "FK_task_dependencies_successor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT IF EXISTS "FK_task_dependencies_predecessor"`,
    );
    await queryRunner.query(`DROP TABLE "task_dependencies"`);
    await queryRunner.query(
      `ALTER TABLE "goal_plan_sub_tasks" DROP CONSTRAINT IF EXISTS "FK_goal_plan_sub_tasks_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_sub_tasks" DROP CONSTRAINT IF EXISTS "FK_goal_plan_sub_tasks_item"`,
    );
    await queryRunner.query(`DROP TABLE "goal_plan_sub_tasks"`);
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP CONSTRAINT IF EXISTS "FK_goal_plan_items_goal"`,
    );
    await queryRunner.query(`DROP TABLE "goal_plan_items"`);
    await queryRunner.query(
      `ALTER TABLE "goal_source_docs" DROP CONSTRAINT IF EXISTS "FK_goal_source_docs_goal"`,
    );
    await queryRunner.query(`DROP TABLE "goal_source_docs"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_goal_id"`,
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
