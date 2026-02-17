import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectsWorkflowTasks1771002000000
  implements MigrationInterface
{
  name = 'CreateProjectsWorkflowTasks1771002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(
      `CREATE TYPE "public"."project_member_role_enum" AS ENUM('owner', 'maintainer', 'developer', 'viewer')`,
    );

    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "businessLineId" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" text, "gitUrl" text NOT NULL, "defaultBranch" character varying(120) NOT NULL DEFAULT 'main', "configJson" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_6271df0a7aed1d6c0691ce6a279" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_projects_business_line_id" ON "projects" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_name" ON "projects" ("name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_projects_business_line_name" ON "projects" ("businessLineId", "name") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "projectId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."project_member_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_project_member_project_user" UNIQUE ("projectId", "userId"), CONSTRAINT "PK_d8ce26c87b1304f6f8f5d6f4054" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_project_id" ON "project_members" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_user_id" ON "project_members" ("userId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."workflow_template_mode_enum" AS ENUM('conversation', 'workflow')`,
    );

    await queryRunner.query(
      `CREATE TABLE "workflow_templates" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "description" text, "mode" "public"."workflow_template_mode_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "latestVersion" integer NOT NULL DEFAULT 0, "nodesJson" jsonb NOT NULL, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_58a5f8bb2e7e3b640a7795f47b2" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_name" ON "workflow_templates" ("name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_name" ON "workflow_templates" ("name") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "workflow_template_versions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "templateId" uuid NOT NULL, "version" integer NOT NULL, "name" character varying(120) NOT NULL, "description" text, "mode" "public"."workflow_template_mode_enum" NOT NULL, "nodesJson" jsonb NOT NULL, "publishedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_workflow_template_version_unique" UNIQUE ("templateId", "version"), CONSTRAINT "PK_8e5ef4881827f4439b2db67644f" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_template_versions_template_id" ON "workflow_template_versions" ("templateId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "FK_workflow_template_versions_template" FOREIGN KEY ("templateId") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."task_mode_enum" AS ENUM('conversation', 'workflow')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_status_enum" AS ENUM('todo', 'in_progress', 'in_review', 'done')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_node_type_enum" AS ENUM('agent', 'skill', 'mcp', 'manual')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_log_level_enum" AS ENUM('info', 'warn', 'error', 'debug')`,
    );

    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "projectId" uuid NOT NULL, "workflowTemplateId" uuid, "workflowTemplateVersion" integer, "mode" "public"."task_mode_enum" NOT NULL, "title" character varying(160) NOT NULL, "description" text, "acceptanceCriteria" jsonb, "status" "public"."task_status_enum" NOT NULL DEFAULT 'todo', "branch" character varying(120), "environment" character varying(120), "toolVersionsSnapshot" jsonb, "createdBy" uuid, "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_id" ON "tasks" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_workflow_template_id" ON "tasks" ("workflowTemplateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_status" ON "tasks" ("status")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_workflow_template" FOREIGN KEY ("workflowTemplateId") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "task_nodes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "taskId" uuid NOT NULL, "nodeOrder" integer NOT NULL, "name" character varying(160) NOT NULL, "nodeType" "public"."task_node_type_enum" NOT NULL, "input" jsonb, "output" jsonb, "requiresApproval" boolean NOT NULL DEFAULT false, "status" "public"."task_status_enum" NOT NULL DEFAULT 'todo', "attempt" integer NOT NULL DEFAULT 0, "errorCode" character varying(120), "errorMessage" text, "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_task_nodes_task_node_order" UNIQUE ("taskId", "nodeOrder"), CONSTRAINT "PK_f4e7f7f59d81ca8eda9f2dbf31f" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_task_id" ON "task_nodes" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_status" ON "task_nodes" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_nodes_single_in_progress" ON "task_nodes" ("taskId") WHERE "status" = 'in_progress'`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD CONSTRAINT "FK_task_nodes_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "task_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "taskId" uuid NOT NULL, "taskNodeId" uuid, "level" "public"."task_log_level_enum" NOT NULL DEFAULT 'info', "message" text NOT NULL, "payload" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b8f8978d9d7ca4bbd7f5f3adbd1" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_task_logs_task_id" ON "task_logs" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_logs_task_node_id" ON "task_logs" ("taskNodeId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_logs" ADD CONSTRAINT "FK_task_logs_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_logs" ADD CONSTRAINT "FK_task_logs_task_node" FOREIGN KEY ("taskNodeId") REFERENCES "task_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_logs" DROP CONSTRAINT "FK_task_logs_task_node"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_logs" DROP CONSTRAINT "FK_task_logs_task"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_task_logs_task_node_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_task_logs_task_id"`);
    await queryRunner.query(`DROP TABLE "task_logs"`);

    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP CONSTRAINT "FK_task_nodes_task"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_task_nodes_single_in_progress"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_task_nodes_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_task_nodes_task_id"`);
    await queryRunner.query(`DROP TABLE "task_nodes"`);

    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_workflow_template"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_project"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tasks_workflow_template_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_project_id"`);
    await queryRunner.query(`DROP TABLE "tasks"`);

    await queryRunner.query(`DROP TYPE "public"."task_log_level_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_node_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_mode_enum"`);

    await queryRunner.query(
      `ALTER TABLE "workflow_template_versions" DROP CONSTRAINT "FK_workflow_template_versions_template"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_workflow_template_versions_template_id"`,
    );
    await queryRunner.query(`DROP TABLE "workflow_template_versions"`);

    await queryRunner.query(`DROP INDEX "public"."UQ_workflow_templates_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_workflow_templates_name"`,
    );
    await queryRunner.query(`DROP TABLE "workflow_templates"`);
    await queryRunner.query(`DROP TYPE "public"."workflow_template_mode_enum"`);

    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_business_line"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_project_id"`,
    );
    await queryRunner.query(`DROP TABLE "project_members"`);

    await queryRunner.query(
      `DROP INDEX "public"."UQ_projects_business_line_name"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_projects_business_line_id"`,
    );
    await queryRunner.query(`DROP TABLE "projects"`);

    await queryRunner.query(`DROP TYPE "public"."project_member_role_enum"`);
  }
}
