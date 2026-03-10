import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAinativeSchema1773128939198 implements MigrationInterface {
  name = 'InitAinativeSchema1773128939198';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(100) NOT NULL, "password" character varying NOT NULL, "salt" character varying, "nickname" character varying, "avatar" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")); COMMENT ON COLUMN "users"."id" IS '主键（UUID）'; COMMENT ON COLUMN "users"."username" IS '登录用户名'; COMMENT ON COLUMN "users"."password" IS '加密密码'; COMMENT ON COLUMN "users"."salt" IS '密码盐'; COMMENT ON COLUMN "users"."nickname" IS '显示昵称'; COMMENT ON COLUMN "users"."avatar" IS '头像地址'; COMMENT ON COLUMN "users"."createdAt" IS '创建时间'; COMMENT ON COLUMN "users"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "users"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_username" ON "users" ("username") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON TABLE "users" IS '系统用户'`);
    await queryRunner.query(
      `CREATE TYPE "public"."workflow_template_mode_enum" AS ENUM('conversation', 'workflow')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workflow_template_scope_enum" AS ENUM('global', 'business_line', 'project')`,
    );
    await queryRunner.query(
      `CREATE TABLE "workflow_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid, "projectId" uuid, "name" character varying(120) NOT NULL, "description" text, "mode" "public"."workflow_template_mode_enum" NOT NULL, "scope" "public"."workflow_template_scope_enum" NOT NULL DEFAULT 'global', "isActive" boolean NOT NULL DEFAULT true, "nodesJson" jsonb NOT NULL, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_de336a1fce23ad3261d49423eae" PRIMARY KEY ("id")); COMMENT ON COLUMN "workflow_templates"."id" IS '主键（UUID）'; COMMENT ON COLUMN "workflow_templates"."businessLineId" IS '所属业务线ID（业务线作用域时填写）'; COMMENT ON COLUMN "workflow_templates"."projectId" IS '所属项目ID（项目作用域时填写）'; COMMENT ON COLUMN "workflow_templates"."name" IS '模板名称'; COMMENT ON COLUMN "workflow_templates"."description" IS '模板描述'; COMMENT ON COLUMN "workflow_templates"."mode" IS '模板模式'; COMMENT ON COLUMN "workflow_templates"."scope" IS '模板作用域（全局/业务线/项目）'; COMMENT ON COLUMN "workflow_templates"."isActive" IS '模板是否启用'; COMMENT ON COLUMN "workflow_templates"."nodesJson" IS '模板工作流节点JSON'; COMMENT ON COLUMN "workflow_templates"."createdBy" IS '创建者用户ID'; COMMENT ON COLUMN "workflow_templates"."createdAt" IS '创建时间'; COMMENT ON COLUMN "workflow_templates"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "workflow_templates"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_business_line_id" ON "workflow_templates" ("businessLineId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_project_id" ON "workflow_templates" ("projectId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_name" ON "workflow_templates" ("name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_project_name" ON "workflow_templates" ("projectId", "name") WHERE "deletedAt" IS NULL AND "scope" = 'project'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_business_line_name" ON "workflow_templates" ("businessLineId", "name") WHERE "deletedAt" IS NULL AND "scope" = 'business_line'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_global_name" ON "workflow_templates" ("name") WHERE "deletedAt" IS NULL AND "scope" = 'global'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "workflow_templates" IS '工作流模板'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_mode_enum" AS ENUM('conversation', 'workflow')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_status_enum" AS ENUM('todo', 'in_progress', 'in_review', 'done')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "projectId" uuid NOT NULL, "mode" "public"."task_mode_enum" NOT NULL, "title" character varying(160) NOT NULL, "prompt" text, "status" "public"."task_status_enum" NOT NULL DEFAULT 'todo', "gitBranch" character varying(120), "gitBaseBranch" character varying(120), "gitWorktree" character varying(500), "configJson" jsonb, "createdBy" uuid, "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id")); COMMENT ON COLUMN "tasks"."id" IS '主键（UUID）'; COMMENT ON COLUMN "tasks"."businessLineId" IS '所属业务线ID'; COMMENT ON COLUMN "tasks"."projectId" IS '关联项目ID'; COMMENT ON COLUMN "tasks"."mode" IS '任务模式'; COMMENT ON COLUMN "tasks"."title" IS '任务标题'; COMMENT ON COLUMN "tasks"."prompt" IS '任务提示词'; COMMENT ON COLUMN "tasks"."status" IS '任务状态'; COMMENT ON COLUMN "tasks"."gitBranch" IS '任务Git分支名称'; COMMENT ON COLUMN "tasks"."gitBaseBranch" IS '任务工作树基线分支'; COMMENT ON COLUMN "tasks"."gitWorktree" IS '任务Git工作树名称/标识（运行时路径可推导）'; COMMENT ON COLUMN "tasks"."configJson" IS '任务执行配置JSON'; COMMENT ON COLUMN "tasks"."createdBy" IS '创建者用户ID'; COMMENT ON COLUMN "tasks"."startedAt" IS '任务执行开始时间'; COMMENT ON COLUMN "tasks"."finishedAt" IS '任务执行结束时间'; COMMENT ON COLUMN "tasks"."createdAt" IS '创建时间'; COMMENT ON COLUMN "tasks"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "tasks"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_business_line_id" ON "tasks" ("businessLineId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_id" ON "tasks" ("projectId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_status" ON "tasks" ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tasks_git_worktree" ON "tasks" ("gitWorktree") WHERE "gitWorktree" IS NOT NULL`,
    );
    await queryRunner.query(`COMMENT ON TABLE "tasks" IS '执行任务'`);
    await queryRunner.query(
      `CREATE TYPE "public"."task_node_status_enum" AS ENUM('todo', 'in_progress', 'in_review', 'done')`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_nodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "nodeOrder" integer NOT NULL, "name" character varying(160) NOT NULL, "input" jsonb, "agentCliId" character varying(64) NOT NULL, "agentCliConfigId" uuid NOT NULL, "agentClioutput" text, "agentCliSessionId" text, "configJson" jsonb, "loopJson" jsonb, "runtimeJson" jsonb, "status" "public"."task_node_status_enum" NOT NULL DEFAULT 'todo', "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_task_nodes_task_node_order" UNIQUE ("taskId", "nodeOrder"), CONSTRAINT "PK_389cdd6e0626609626f572c2877" PRIMARY KEY ("id")); COMMENT ON COLUMN "task_nodes"."id" IS '主键（UUID）'; COMMENT ON COLUMN "task_nodes"."taskId" IS '关联任务ID'; COMMENT ON COLUMN "task_nodes"."nodeOrder" IS '节点在任务中的顺序'; COMMENT ON COLUMN "task_nodes"."name" IS '节点名称'; COMMENT ON COLUMN "task_nodes"."input" IS '节点输入JSON'; COMMENT ON COLUMN "task_nodes"."agentCliId" IS 'Agent CLI ID'; COMMENT ON COLUMN "task_nodes"."agentCliConfigId" IS 'Agent CLI配置ID'; COMMENT ON COLUMN "task_nodes"."agentClioutput" IS 'Agent CLI日志JSONL文件地址'; COMMENT ON COLUMN "task_nodes"."agentCliSessionId" IS 'Agent CLI对话会话ID'; COMMENT ON COLUMN "task_nodes"."configJson" IS '节点配置JSON'; COMMENT ON COLUMN "task_nodes"."loopJson" IS '循环执行配置JSON'; COMMENT ON COLUMN "task_nodes"."runtimeJson" IS '节点运行时临时状态JSON'; COMMENT ON COLUMN "task_nodes"."status" IS '节点状态'; COMMENT ON COLUMN "task_nodes"."startedAt" IS '节点执行开始时间'; COMMENT ON COLUMN "task_nodes"."finishedAt" IS '节点执行结束时间'; COMMENT ON COLUMN "task_nodes"."createdAt" IS '创建时间'; COMMENT ON COLUMN "task_nodes"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_task_id" ON "task_nodes" ("taskId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_status" ON "task_nodes" ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_nodes_single_in_progress" ON "task_nodes" ("taskId") WHERE "status" = 'in_progress'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_task_status_order" ON "task_nodes" ("taskId", "status", "nodeOrder") `,
    );
    await queryRunner.query(`COMMENT ON TABLE "task_nodes" IS '任务执行节点'`);
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" text, "gitUrl" text NOT NULL, "defaultBranch" character varying(120) NOT NULL DEFAULT 'main', "configJson" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id")); COMMENT ON COLUMN "projects"."id" IS '主键（UUID）'; COMMENT ON COLUMN "projects"."businessLineId" IS '所属业务线ID'; COMMENT ON COLUMN "projects"."name" IS '项目名称'; COMMENT ON COLUMN "projects"."description" IS '项目描述'; COMMENT ON COLUMN "projects"."gitUrl" IS 'Git仓库地址'; COMMENT ON COLUMN "projects"."defaultBranch" IS '默认仓库分支'; COMMENT ON COLUMN "projects"."configJson" IS '项目配置JSON'; COMMENT ON COLUMN "projects"."createdAt" IS '创建时间'; COMMENT ON COLUMN "projects"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "projects"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_business_line_id" ON "projects" ("businessLineId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_name" ON "projects" ("name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_projects_business_line_name" ON "projects" ("businessLineId", "name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON TABLE "projects" IS '业务线下项目'`);
    await queryRunner.query(
      `CREATE TABLE "business_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_c2d8ed0937c0e59c345ffe486d3" PRIMARY KEY ("id")); COMMENT ON COLUMN "business_lines"."id" IS '主键（UUID）'; COMMENT ON COLUMN "business_lines"."name" IS '业务线名称'; COMMENT ON COLUMN "business_lines"."description" IS '业务线描述'; COMMENT ON COLUMN "business_lines"."createdAt" IS '创建时间'; COMMENT ON COLUMN "business_lines"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "business_lines"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_lines_name" ON "business_lines" ("name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_lines_name" ON "business_lines" ("name") `,
    );
    await queryRunner.query(`COMMENT ON TABLE "business_lines" IS '业务线'`);
    await queryRunner.query(
      `CREATE TABLE "project_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(255), "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8ac6a6996b6eaeae7b8fbb669f1" PRIMARY KEY ("id")); COMMENT ON COLUMN "project_roles"."id" IS '主键（UUID）'; COMMENT ON COLUMN "project_roles"."businessLineId" IS '所属业务线ID'; COMMENT ON COLUMN "project_roles"."name" IS '角色名称'; COMMENT ON COLUMN "project_roles"."description" IS '角色描述'; COMMENT ON COLUMN "project_roles"."capabilities" IS '能力码列表(JSON)'; COMMENT ON COLUMN "project_roles"."createdAt" IS '创建时间'; COMMENT ON COLUMN "project_roles"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_role_business_line_id" ON "project_roles" ("businessLineId") `,
    );
    await queryRunner.query(`COMMENT ON TABLE "project_roles" IS '项目角色'`);
    await queryRunner.query(
      `CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "userId" uuid NOT NULL, "roleId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_project_member_project_user" UNIQUE ("projectId", "userId"), CONSTRAINT "PK_0b2f46f804be4aea9234c78bcc9" PRIMARY KEY ("id")); COMMENT ON COLUMN "project_members"."id" IS '主键（UUID）'; COMMENT ON COLUMN "project_members"."projectId" IS '关联项目ID'; COMMENT ON COLUMN "project_members"."userId" IS '关联用户ID'; COMMENT ON COLUMN "project_members"."roleId" IS '项目角色ID'; COMMENT ON COLUMN "project_members"."createdAt" IS '创建时间'; COMMENT ON COLUMN "project_members"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_project_id" ON "project_members" ("projectId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_user_id" ON "project_members" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_role_id" ON "project_members" ("roleId") `,
    );
    await queryRunner.query(`COMMENT ON TABLE "project_members" IS '项目成员'`);
    await queryRunner.query(
      `CREATE TABLE "notification_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "emailEnabled" boolean NOT NULL DEFAULT false, "emailAddress" character varying(255), "webhookEnabled" boolean NOT NULL DEFAULT false, "webhookUrl" text, "browserEnabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d131abd7996c475ef768d4559ba" PRIMARY KEY ("id")); COMMENT ON COLUMN "notification_settings"."id" IS '主键（UUID）'; COMMENT ON COLUMN "notification_settings"."userId" IS '关联用户ID'; COMMENT ON COLUMN "notification_settings"."emailEnabled" IS '是否启用邮件通知'; COMMENT ON COLUMN "notification_settings"."emailAddress" IS '通知邮箱地址'; COMMENT ON COLUMN "notification_settings"."webhookEnabled" IS '是否启用Webhook通知'; COMMENT ON COLUMN "notification_settings"."webhookUrl" IS '回调地址'; COMMENT ON COLUMN "notification_settings"."browserEnabled" IS '是否启用浏览器通知'; COMMENT ON COLUMN "notification_settings"."createdAt" IS '创建时间'; COMMENT ON COLUMN "notification_settings"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_settings_user_id" ON "notification_settings" ("userId") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "notification_settings" IS '用户通知偏好设置'`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "taskId" uuid, "eventType" character varying(120) NOT NULL, "title" character varying(200) NOT NULL, "content" text NOT NULL, "payload" jsonb, "readAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5b828caf9bd52c7e580f5768b14" PRIMARY KEY ("id")); COMMENT ON COLUMN "notification_events"."id" IS '主键（UUID）'; COMMENT ON COLUMN "notification_events"."userId" IS '目标用户ID'; COMMENT ON COLUMN "notification_events"."taskId" IS '关联任务ID'; COMMENT ON COLUMN "notification_events"."eventType" IS '通知事件类型'; COMMENT ON COLUMN "notification_events"."title" IS '通知标题'; COMMENT ON COLUMN "notification_events"."content" IS '通知内容'; COMMENT ON COLUMN "notification_events"."payload" IS '通知载荷JSON'; COMMENT ON COLUMN "notification_events"."readAt" IS '已读时间'; COMMENT ON COLUMN "notification_events"."createdAt" IS '创建时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_user_id" ON "notification_events" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_task_id" ON "notification_events" ("taskId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_read_at" ON "notification_events" ("readAt") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "notification_events" IS '用户通知事件'`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_line_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(255), "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_97a877b75b8db5f5fafa1824dfd" PRIMARY KEY ("id")); COMMENT ON COLUMN "business_line_roles"."id" IS '主键（UUID）'; COMMENT ON COLUMN "business_line_roles"."businessLineId" IS '所属业务线ID'; COMMENT ON COLUMN "business_line_roles"."name" IS '角色名称'; COMMENT ON COLUMN "business_line_roles"."description" IS '角色描述'; COMMENT ON COLUMN "business_line_roles"."capabilities" IS '能力码列表(JSON)'; COMMENT ON COLUMN "business_line_roles"."createdAt" IS '创建时间'; COMMENT ON COLUMN "business_line_roles"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_role_business_line_id" ON "business_line_roles" ("businessLineId") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "business_line_roles" IS '业务线角色'`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_line_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "token" character varying(128) NOT NULL, "roleId" uuid NOT NULL, "projectRoles" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdBy" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2cd94765894fc2895c60732725b" PRIMARY KEY ("id")); COMMENT ON COLUMN "business_line_invitations"."id" IS '主键（UUID）'; COMMENT ON COLUMN "business_line_invitations"."businessLineId" IS '关联业务线ID'; COMMENT ON COLUMN "business_line_invitations"."token" IS '邀请令牌'; COMMENT ON COLUMN "business_line_invitations"."roleId" IS '业务线角色ID'; COMMENT ON COLUMN "business_line_invitations"."projectRoles" IS '按项目分配的成员角色JSON'; COMMENT ON COLUMN "business_line_invitations"."createdBy" IS '邀请创建者用户ID'; COMMENT ON COLUMN "business_line_invitations"."expiresAt" IS '邀请过期时间'; COMMENT ON COLUMN "business_line_invitations"."revokedAt" IS '邀请撤销时间'; COMMENT ON COLUMN "business_line_invitations"."createdAt" IS '创建时间'; COMMENT ON COLUMN "business_line_invitations"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_invitation_business_line_id" ON "business_line_invitations" ("businessLineId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_invitation_token" ON "business_line_invitations" ("token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_invitation_role_id" ON "business_line_invitations" ("roleId") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "business_line_invitations" IS '业务线邀请'`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_line_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "userId" uuid NOT NULL, "roleId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_business_line_member_business_line_user" UNIQUE ("businessLineId", "userId"), CONSTRAINT "PK_5380ba4309f72e01608061dccf0" PRIMARY KEY ("id")); COMMENT ON COLUMN "business_line_members"."id" IS '主键（UUID）'; COMMENT ON COLUMN "business_line_members"."businessLineId" IS '关联业务线ID'; COMMENT ON COLUMN "business_line_members"."userId" IS '关联用户ID'; COMMENT ON COLUMN "business_line_members"."roleId" IS '业务线角色ID'; COMMENT ON COLUMN "business_line_members"."createdAt" IS '创建时间'; COMMENT ON COLUMN "business_line_members"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_business_line_id" ON "business_line_members" ("businessLineId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_user_id" ON "business_line_members" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_role_id" ON "business_line_members" ("roleId") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "business_line_members" IS '业务线成员'`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_cli_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "toolId" character varying(64) NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(255), "configJson" text NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c78a5a8e8c260d468f162d1bb3a" PRIMARY KEY ("id")); COMMENT ON COLUMN "agent_cli_configs"."id" IS '主键（UUID）'; COMMENT ON COLUMN "agent_cli_configs"."businessLineId" IS '关联业务线ID'; COMMENT ON COLUMN "agent_cli_configs"."toolId" IS '工具标识'; COMMENT ON COLUMN "agent_cli_configs"."name" IS '配置名称'; COMMENT ON COLUMN "agent_cli_configs"."description" IS '配置描述'; COMMENT ON COLUMN "agent_cli_configs"."configJson" IS '工具配置JSON'; COMMENT ON COLUMN "agent_cli_configs"."isDefault" IS '是否默认配置'; COMMENT ON COLUMN "agent_cli_configs"."createdAt" IS '创建时间'; COMMENT ON COLUMN "agent_cli_configs"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_cli_config_default_per_tool" ON "agent_cli_configs" ("businessLineId", "toolId") WHERE "isDefault" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_cli_config_business_line_tool_name" ON "agent_cli_configs" ("businessLineId", "toolId", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_cli_config_tool_id" ON "agent_cli_configs" ("toolId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_cli_config_business_line_id" ON "agent_cli_configs" ("businessLineId") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "agent_cli_configs" IS '业务线工具配置'`,
    );
    await queryRunner.query(
      `CREATE TABLE "automations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "prompt" text NOT NULL, "rrule" character varying(255) NOT NULL, "cwds" jsonb, "status" character varying(20) NOT NULL DEFAULT 'active', "lastRunAt" TIMESTAMP, "nextRunAt" TIMESTAMP, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_34c2cc382fc780ea36f7c478192" PRIMARY KEY ("id")); COMMENT ON COLUMN "automations"."id" IS '主键（UUID）'; COMMENT ON COLUMN "automations"."name" IS '自动化名称'; COMMENT ON COLUMN "automations"."prompt" IS '自动化提示词内容'; COMMENT ON COLUMN "automations"."rrule" IS '自动化调度规则'; COMMENT ON COLUMN "automations"."cwds" IS '工作目录列表(JSON)'; COMMENT ON COLUMN "automations"."status" IS '自动化状态'; COMMENT ON COLUMN "automations"."lastRunAt" IS '最近执行时间'; COMMENT ON COLUMN "automations"."nextRunAt" IS '下次执行时间'; COMMENT ON COLUMN "automations"."createdBy" IS '创建者用户ID'; COMMENT ON COLUMN "automations"."createdAt" IS '创建时间'; COMMENT ON COLUMN "automations"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "automations"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_automations_name" ON "automations" ("name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_created_by" ON "automations" ("createdBy") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_status" ON "automations" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_name" ON "automations" ("name") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "automations" IS '定时自动化定义'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD CONSTRAINT "FK_319df5722192180982f8bdd048e" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" ADD CONSTRAINT "FK_b98414f6aa99da0b3e1cc344332" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_d19892d8f03928e5bfc7313780c" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_91dd6fc1e69a4b682f780a0c437" FOREIGN KEY ("roleId") REFERENCES "project_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_roles" ADD CONSTRAINT "FK_db4dd7ddeb3763658fd8d16a816" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_8fc93bc994d44ce778226eec4be" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_bee220728ae119d9b40ccf2b318" FOREIGN KEY ("roleId") REFERENCES "business_line_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_ae8604971b2eccdad4f61131366" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_a9989b25938261a6c8a4fde8acf" FOREIGN KEY ("roleId") REFERENCES "business_line_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_cli_configs" ADD CONSTRAINT "FK_8a1996a8937fe83f2204843fc4e" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_cli_configs" DROP CONSTRAINT "FK_8a1996a8937fe83f2204843fc4e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT "FK_a9989b25938261a6c8a4fde8acf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT "FK_ae8604971b2eccdad4f61131366"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP CONSTRAINT "FK_bee220728ae119d9b40ccf2b318"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP CONSTRAINT "FK_8fc93bc994d44ce778226eec4be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_roles" DROP CONSTRAINT "FK_db4dd7ddeb3763658fd8d16a816"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_91dd6fc1e69a4b682f780a0c437"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_d19892d8f03928e5bfc7313780c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" DROP CONSTRAINT "FK_b98414f6aa99da0b3e1cc344332"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP CONSTRAINT "FK_319df5722192180982f8bdd048e"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "automations" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."IDX_automations_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_automations_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_automations_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_automations_name"`);
    await queryRunner.query(`DROP TABLE "automations"`);
    await queryRunner.query(`COMMENT ON TABLE "agent_cli_configs" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_cli_config_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_cli_config_tool_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_agent_cli_config_business_line_tool_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_agent_cli_config_default_per_tool"`,
    );
    await queryRunner.query(`DROP TABLE "agent_cli_configs"`);
    await queryRunner.query(`COMMENT ON TABLE "business_line_members" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_member_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_member_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_member_business_line_id"`,
    );
    await queryRunner.query(`DROP TABLE "business_line_members"`);
    await queryRunner.query(
      `COMMENT ON TABLE "business_line_invitations" IS NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_invitation_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_business_line_invitation_token"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_invitation_business_line_id"`,
    );
    await queryRunner.query(`DROP TABLE "business_line_invitations"`);
    await queryRunner.query(`COMMENT ON TABLE "business_line_roles" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_role_business_line_id"`,
    );
    await queryRunner.query(`DROP TABLE "business_line_roles"`);
    await queryRunner.query(`COMMENT ON TABLE "notification_events" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_events_read_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_events_task_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_events_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "notification_events"`);
    await queryRunner.query(`COMMENT ON TABLE "notification_settings" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_notification_settings_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "notification_settings"`);
    await queryRunner.query(`COMMENT ON TABLE "project_members" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_project_id"`,
    );
    await queryRunner.query(`DROP TABLE "project_members"`);
    await queryRunner.query(`COMMENT ON TABLE "project_roles" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_role_business_line_id"`,
    );
    await queryRunner.query(`DROP TABLE "project_roles"`);
    await queryRunner.query(`COMMENT ON TABLE "business_lines" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."IDX_business_lines_name"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_business_lines_name"`);
    await queryRunner.query(`DROP TABLE "business_lines"`);
    await queryRunner.query(`COMMENT ON TABLE "projects" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_projects_business_line_name"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_projects_business_line_id"`,
    );
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`COMMENT ON TABLE "task_nodes" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_nodes_task_status_order"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_task_nodes_single_in_progress"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_task_nodes_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_task_nodes_task_id"`);
    await queryRunner.query(`DROP TABLE "task_nodes"`);
    await queryRunner.query(`DROP TYPE "public"."task_node_status_enum"`);
    await queryRunner.query(`COMMENT ON TABLE "tasks" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."UQ_tasks_git_worktree"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_project_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_business_line_id"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "public"."task_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_mode_enum"`);
    await queryRunner.query(`COMMENT ON TABLE "workflow_templates" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_workflow_templates_global_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_workflow_templates_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_workflow_templates_project_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_workflow_templates_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_workflow_templates_project_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_workflow_templates_business_line_id"`,
    );
    await queryRunner.query(`DROP TABLE "workflow_templates"`);
    await queryRunner.query(
      `DROP TYPE "public"."workflow_template_scope_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."workflow_template_mode_enum"`);
    await queryRunner.query(`COMMENT ON TABLE "users" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_username"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
