import { MigrationInterface, QueryRunner } from 'typeorm';

type TableComment = {
  table: string;
  comment: string;
};

type ColumnComment = {
  table: string;
  column: string;
  comment: string;
};

const TABLE_COMMENTS: TableComment[] = [
  { table: 'users', comment: '系统用户' },
  { table: 'business_lines', comment: '业务线' },
  { table: 'business_line_members', comment: '业务线成员' },
  { table: 'business_line_invitations', comment: '业务线邀请' },
  { table: 'agent_tool_configs', comment: '业务线工具配置' },
  { table: 'projects', comment: '业务线下项目' },
  { table: 'project_members', comment: '项目成员' },
  { table: 'workflow_templates', comment: '工作流模板' },
  { table: 'tasks', comment: '执行任务' },
  { table: 'task_nodes', comment: '任务执行节点' },
  { table: 'task_logs', comment: '任务执行日志' },
  { table: 'task_artifacts', comment: '任务执行产生的工件' },
  { table: 'notification_settings', comment: '用户通知偏好设置' },
  { table: 'notification_events', comment: '用户通知事件' },
  { table: 'automations', comment: '定时自动化定义' },
];

const COLUMN_COMMENTS: ColumnComment[] = [
  { table: 'users', column: 'id', comment: '主键（UUID）' },
  { table: 'users', column: 'username', comment: '登录用户名' },
  { table: 'users', column: 'password', comment: '加密密码' },
  { table: 'users', column: 'salt', comment: '密码盐' },
  { table: 'users', column: 'nickname', comment: '显示昵称' },
  { table: 'users', column: 'avatar', comment: '头像地址' },
  { table: 'users', column: 'isAdmin', comment: '是否管理员' },
  { table: 'users', column: 'createdAt', comment: '创建时间' },
  { table: 'users', column: 'updatedAt', comment: '更新时间' },
  { table: 'users', column: 'deletedAt', comment: '软删除时间' },

  { table: 'business_lines', column: 'id', comment: '主键（UUID）' },
  { table: 'business_lines', column: 'name', comment: '业务线名称' },
  { table: 'business_lines', column: 'description', comment: '业务线描述' },
  { table: 'business_lines', column: 'createdAt', comment: '创建时间' },
  { table: 'business_lines', column: 'updatedAt', comment: '更新时间' },
  { table: 'business_lines', column: 'deletedAt', comment: '软删除时间' },

  { table: 'business_line_members', column: 'id', comment: '主键（UUID）' },
  {
    table: 'business_line_members',
    column: 'businessLineId',
    comment: '关联业务线ID',
  },
  { table: 'business_line_members', column: 'userId', comment: '关联用户ID' },
  { table: 'business_line_members', column: 'role', comment: '成员角色' },
  { table: 'business_line_members', column: 'createdAt', comment: '创建时间' },
  { table: 'business_line_members', column: 'updatedAt', comment: '更新时间' },

  {
    table: 'business_line_invitations',
    column: 'id',
    comment: '主键（UUID）',
  },
  {
    table: 'business_line_invitations',
    column: 'businessLineId',
    comment: '关联业务线ID',
  },
  {
    table: 'business_line_invitations',
    column: 'token',
    comment: '邀请令牌',
  },
  {
    table: 'business_line_invitations',
    column: 'role',
    comment: '邀请成员角色',
  },
  {
    table: 'business_line_invitations',
    column: 'projectRoles',
    comment: '按项目分配的成员角色JSON',
  },
  {
    table: 'business_line_invitations',
    column: 'createdBy',
    comment: '邀请创建者用户ID',
  },
  {
    table: 'business_line_invitations',
    column: 'expiresAt',
    comment: '邀请过期时间',
  },
  {
    table: 'business_line_invitations',
    column: 'revokedAt',
    comment: '邀请撤销时间',
  },
  {
    table: 'business_line_invitations',
    column: 'createdAt',
    comment: '创建时间',
  },
  {
    table: 'business_line_invitations',
    column: 'updatedAt',
    comment: '更新时间',
  },

  { table: 'agent_tool_configs', column: 'id', comment: '主键（UUID）' },
  {
    table: 'agent_tool_configs',
    column: 'businessLineId',
    comment: '关联业务线ID',
  },
  { table: 'agent_tool_configs', column: 'toolId', comment: '工具标识' },
  { table: 'agent_tool_configs', column: 'name', comment: '配置名称' },
  { table: 'agent_tool_configs', column: 'description', comment: '配置描述' },
  {
    table: 'agent_tool_configs',
    column: 'configJson',
    comment: '工具配置JSON',
  },
  {
    table: 'agent_tool_configs',
    column: 'isDefault',
    comment: '是否默认配置',
  },
  { table: 'agent_tool_configs', column: 'createdAt', comment: '创建时间' },
  { table: 'agent_tool_configs', column: 'updatedAt', comment: '更新时间' },

  { table: 'projects', column: 'id', comment: '主键（UUID）' },
  { table: 'projects', column: 'businessLineId', comment: '所属业务线ID' },
  { table: 'projects', column: 'name', comment: '项目名称' },
  { table: 'projects', column: 'description', comment: '项目描述' },
  { table: 'projects', column: 'gitUrl', comment: 'Git仓库地址' },
  { table: 'projects', column: 'defaultBranch', comment: '默认仓库分支' },
  { table: 'projects', column: 'configJson', comment: '项目配置JSON' },
  { table: 'projects', column: 'createdAt', comment: '创建时间' },
  { table: 'projects', column: 'updatedAt', comment: '更新时间' },
  { table: 'projects', column: 'deletedAt', comment: '软删除时间' },

  { table: 'project_members', column: 'id', comment: '主键（UUID）' },
  { table: 'project_members', column: 'projectId', comment: '关联项目ID' },
  { table: 'project_members', column: 'userId', comment: '关联用户ID' },
  { table: 'project_members', column: 'role', comment: '项目成员角色' },
  { table: 'project_members', column: 'createdAt', comment: '创建时间' },
  { table: 'project_members', column: 'updatedAt', comment: '更新时间' },

  {
    table: 'workflow_templates',
    column: 'id',
    comment: '主键（UUID）',
  },
  { table: 'workflow_templates', column: 'name', comment: '模板名称' },
  {
    table: 'workflow_templates',
    column: 'description',
    comment: '模板描述',
  },
  { table: 'workflow_templates', column: 'mode', comment: '模板模式' },
  {
    table: 'workflow_templates',
    column: 'scope',
    comment: '模板作用域（全局/业务线/项目）',
  },
  {
    table: 'workflow_templates',
    column: 'businessLineId',
    comment: '所属业务线ID（业务线作用域时填写）',
  },
  {
    table: 'workflow_templates',
    column: 'projectId',
    comment: '所属项目ID（项目作用域时填写）',
  },
  {
    table: 'workflow_templates',
    column: 'isActive',
    comment: '模板是否启用',
  },
  {
    table: 'workflow_templates',
    column: 'nodesJson',
    comment: '模板工作流节点JSON',
  },
  {
    table: 'workflow_templates',
    column: 'createdBy',
    comment: '创建者用户ID',
  },
  {
    table: 'workflow_templates',
    column: 'createdAt',
    comment: '创建时间',
  },
  {
    table: 'workflow_templates',
    column: 'updatedAt',
    comment: '更新时间',
  },
  {
    table: 'workflow_templates',
    column: 'deletedAt',
    comment: '软删除时间',
  },

  { table: 'tasks', column: 'id', comment: '主键（UUID）' },
  { table: 'tasks', column: 'projectId', comment: '关联项目ID' },
  { table: 'tasks', column: 'businessLineId', comment: '所属业务线ID' },
  {
    table: 'tasks',
    column: 'workflowTemplateId',
    comment: '关联工作流模板ID',
  },
  { table: 'tasks', column: 'mode', comment: '任务模式' },
  { table: 'tasks', column: 'title', comment: '任务标题' },
  { table: 'tasks', column: 'prompt', comment: '任务提示词' },
  { table: 'tasks', column: 'status', comment: '任务状态' },
  { table: 'tasks', column: 'gitBranch', comment: '任务Git分支名称' },
  {
    table: 'tasks',
    column: 'gitBaseBranch',
    comment: '任务工作树基线分支',
  },
  {
    table: 'tasks',
    column: 'gitWorktree',
    comment: '任务Git工作树文件系统路径',
  },
  {
    table: 'tasks',
    column: 'clientInputSnapshot',
    comment: '客户端输入快照JSON',
  },
  { table: 'tasks', column: 'cliToolId', comment: 'CLI工具标识' },
  {
    table: 'tasks',
    column: 'agentToolConfigId',
    comment: '关联工具配置ID',
  },
  { table: 'tasks', column: 'createdBy', comment: '创建者用户ID' },
  { table: 'tasks', column: 'startedAt', comment: '任务执行开始时间' },
  { table: 'tasks', column: 'finishedAt', comment: '任务执行结束时间' },
  { table: 'tasks', column: 'createdAt', comment: '创建时间' },
  { table: 'tasks', column: 'updatedAt', comment: '更新时间' },
  { table: 'tasks', column: 'deletedAt', comment: '软删除时间' },

  { table: 'task_nodes', column: 'id', comment: '主键（UUID）' },
  { table: 'task_nodes', column: 'taskId', comment: '关联任务ID' },
  { table: 'task_nodes', column: 'nodeOrder', comment: '节点在任务中的顺序' },
  { table: 'task_nodes', column: 'name', comment: '节点名称' },
  { table: 'task_nodes', column: 'nodeType', comment: '节点类型' },
  { table: 'task_nodes', column: 'input', comment: '节点输入JSON' },
  { table: 'task_nodes', column: 'output', comment: '节点输出JSON' },
  {
    table: 'task_nodes',
    column: 'requiresApproval',
    comment: '节点是否需要人工审批',
  },
  { table: 'task_nodes', column: 'status', comment: '节点状态' },
  { table: 'task_nodes', column: 'attempt', comment: '重试次数' },
  { table: 'task_nodes', column: 'errorCode', comment: '错误码' },
  { table: 'task_nodes', column: 'errorMessage', comment: '错误详情' },
  { table: 'task_nodes', column: 'startedAt', comment: '节点执行开始时间' },
  {
    table: 'task_nodes',
    column: 'finishedAt',
    comment: '节点执行结束时间',
  },
  {
    table: 'task_nodes',
    column: 'workerId',
    comment: '持有租约的工作进程ID',
  },
  { table: 'task_nodes', column: 'leaseUntil', comment: '租约过期时间' },
  {
    table: 'task_nodes',
    column: 'heartbeatAt',
    comment: '最近工作进程心跳时间',
  },
  { table: 'task_nodes', column: 'createdAt', comment: '创建时间' },
  { table: 'task_nodes', column: 'updatedAt', comment: '更新时间' },

  { table: 'task_logs', column: 'id', comment: '主键（UUID）' },
  { table: 'task_logs', column: 'taskId', comment: '关联任务ID' },
  { table: 'task_logs', column: 'taskNodeId', comment: '关联任务节点ID' },
  { table: 'task_logs', column: 'level', comment: '日志级别' },
  { table: 'task_logs', column: 'message', comment: '日志消息内容' },
  { table: 'task_logs', column: 'payload', comment: '结构化日志载荷JSON' },
  { table: 'task_logs', column: 'createdAt', comment: '创建时间' },

  { table: 'task_artifacts', column: 'id', comment: '主键（UUID）' },
  { table: 'task_artifacts', column: 'taskId', comment: '关联任务ID' },
  { table: 'task_artifacts', column: 'taskNodeId', comment: '关联任务节点ID' },
  { table: 'task_artifacts', column: 'artifactType', comment: '工件类型' },
  { table: 'task_artifacts', column: 'name', comment: '工件名称' },
  { table: 'task_artifacts', column: 'downloadUrl', comment: '工件下载地址' },
  { table: 'task_artifacts', column: 'content', comment: '内联工件内容' },
  { table: 'task_artifacts', column: 'metadata', comment: '工件元数据JSON' },
  { table: 'task_artifacts', column: 'createdAt', comment: '创建时间' },

  {
    table: 'notification_settings',
    column: 'id',
    comment: '主键（UUID）',
  },
  {
    table: 'notification_settings',
    column: 'userId',
    comment: '关联用户ID',
  },
  {
    table: 'notification_settings',
    column: 'emailEnabled',
    comment: '是否启用邮件通知',
  },
  {
    table: 'notification_settings',
    column: 'emailAddress',
    comment: '通知邮箱地址',
  },
  {
    table: 'notification_settings',
    column: 'webhookEnabled',
    comment: '是否启用Webhook通知',
  },
  {
    table: 'notification_settings',
    column: 'webhookUrl',
    comment: '回调地址',
  },
  {
    table: 'notification_settings',
    column: 'browserEnabled',
    comment: '是否启用浏览器通知',
  },
  {
    table: 'notification_settings',
    column: 'createdAt',
    comment: '创建时间',
  },
  {
    table: 'notification_settings',
    column: 'updatedAt',
    comment: '更新时间',
  },

  {
    table: 'notification_events',
    column: 'id',
    comment: '主键（UUID）',
  },
  {
    table: 'notification_events',
    column: 'userId',
    comment: '目标用户ID',
  },
  {
    table: 'notification_events',
    column: 'taskId',
    comment: '关联任务ID',
  },
  {
    table: 'notification_events',
    column: 'eventType',
    comment: '通知事件类型',
  },
  { table: 'notification_events', column: 'title', comment: '通知标题' },
  { table: 'notification_events', column: 'content', comment: '通知内容' },
  {
    table: 'notification_events',
    column: 'payload',
    comment: '通知载荷JSON',
  },
  { table: 'notification_events', column: 'readAt', comment: '已读时间' },
  { table: 'notification_events', column: 'createdAt', comment: '创建时间' },

  { table: 'automations', column: 'id', comment: '主键（UUID）' },
  { table: 'automations', column: 'name', comment: '自动化名称' },
  { table: 'automations', column: 'prompt', comment: '自动化提示词内容' },
  { table: 'automations', column: 'rrule', comment: '自动化调度规则' },
  { table: 'automations', column: 'cwds', comment: '工作目录列表(JSON)' },
  { table: 'automations', column: 'status', comment: '自动化状态' },
  { table: 'automations', column: 'lastRunAt', comment: '最近执行时间' },
  { table: 'automations', column: 'nextRunAt', comment: '下次执行时间' },
  { table: 'automations', column: 'createdBy', comment: '创建者用户ID' },
  { table: 'automations', column: 'createdAt', comment: '创建时间' },
  { table: 'automations', column: 'updatedAt', comment: '更新时间' },
  { table: 'automations', column: 'deletedAt', comment: '软删除时间' },
];


export class InitAinativeSchema1772722882499 implements MigrationInterface {
  name = 'InitAinativeSchema1772722882499';

  private escapeComment(comment: string): string {
    return comment.replace(/'/g, "''");
  }

  private async setTableComment(
    queryRunner: QueryRunner,
    tableName: string,
    comment: string | null,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }

    const commentSql =
      comment === null ? 'NULL' : `'${this.escapeComment(comment)}'`;
    await queryRunner.query(`COMMENT ON TABLE "${tableName}" IS ${commentSql}`);
  }

  private async setColumnComment(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    comment: string | null,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }

    if (!(await queryRunner.hasColumn(tableName, columnName))) {
      return;
    }

    const commentSql =
      comment === null ? 'NULL' : `'${this.escapeComment(comment)}'`;
    await queryRunner.query(
      `COMMENT ON COLUMN "${tableName}"."${columnName}" IS ${commentSql}`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TYPE "public"."business_line_member_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."project_member_role_enum" AS ENUM('owner', 'maintainer', 'developer', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workflow_template_mode_enum" AS ENUM('conversation', 'workflow')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workflow_template_scope_enum" AS ENUM('global', 'business_line', 'project')`,
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
      `CREATE TYPE "public"."task_artifact_type_enum" AS ENUM('diff', 'report', 'file', 'preview')`,
    );

    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(100) NOT NULL, "password" character varying NOT NULL, "salt" character varying, "nickname" character varying, "avatar" character varying, "isAdmin" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_users_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_username" ON "users" ("username") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "business_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_business_lines_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_lines_name" ON "business_lines" ("name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_lines_name" ON "business_lines" ("name") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "business_line_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."business_line_member_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_business_line_member_business_line_user" UNIQUE ("businessLineId", "userId"), CONSTRAINT "PK_business_line_members_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_business_line_id" ON "business_line_members" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_user_id" ON "business_line_members" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_business_line_members_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_business_line_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "business_line_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "token" character varying(128) NOT NULL, "role" "public"."business_line_member_role_enum" NOT NULL, "projectRoles" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdBy" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_business_line_invitations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_invitation_business_line_id" ON "business_line_invitations" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_invitation_token" ON "business_line_invitations" ("token")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_business_line_invitation_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_business_line_invitation_created_by" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "agent_tool_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "toolId" character varying(64) NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(255), "configJson" text NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_agent_tool_configs_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_tool_config_business_line_id" ON "agent_tool_configs" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_tool_config_tool_id" ON "agent_tool_configs" ("toolId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_tool_config_business_line_tool_name" ON "agent_tool_configs" ("businessLineId", "toolId", "name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_tool_config_default_per_tool" ON "agent_tool_configs" ("businessLineId", "toolId") WHERE "isDefault" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_configs" ADD CONSTRAINT "FK_agent_tool_config_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" text, "gitUrl" text NOT NULL, "defaultBranch" character varying(120) NOT NULL DEFAULT 'main', "configJson" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_projects_id" PRIMARY KEY ("id"))`,
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
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."project_member_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_project_member_project_user" UNIQUE ("projectId", "userId"), CONSTRAINT "PK_project_members_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_project_id" ON "project_members" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_user_id" ON "project_members" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "workflow_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "description" text, "mode" "public"."workflow_template_mode_enum" NOT NULL, "scope" "public"."workflow_template_scope_enum" NOT NULL DEFAULT 'global', "businessLineId" uuid, "projectId" uuid, "isActive" boolean NOT NULL DEFAULT true, "nodesJson" jsonb NOT NULL, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_workflow_templates_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_name" ON "workflow_templates" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_business_line_id" ON "workflow_templates" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_project_id" ON "workflow_templates" ("projectId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD CONSTRAINT "FK_workflow_templates_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD CONSTRAINT "FK_workflow_templates_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_global_name" ON "workflow_templates" ("name") WHERE "deletedAt" IS NULL AND "scope" = 'global'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_business_line_name" ON "workflow_templates" ("businessLineId", "name") WHERE "deletedAt" IS NULL AND "scope" = 'business_line'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_project_name" ON "workflow_templates" ("projectId", "name") WHERE "deletedAt" IS NULL AND "scope" = 'project'`,
    );

    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "businessLineId" uuid NOT NULL, "workflowTemplateId" uuid, "mode" "public"."task_mode_enum" NOT NULL, "title" character varying(160) NOT NULL, "prompt" text, "status" "public"."task_status_enum" NOT NULL DEFAULT 'todo', "gitBranch" character varying(120), "gitBaseBranch" character varying(120), "gitWorktree" character varying(500), "clientInputSnapshot" jsonb, "cliToolId" character varying(64), "agentToolConfigId" uuid, "createdBy" uuid, "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_tasks_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_id" ON "tasks" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_business_line_id" ON "tasks" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_workflow_template_id" ON "tasks" ("workflowTemplateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_status" ON "tasks" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tasks_git_worktree" ON "tasks" ("gitWorktree") WHERE "gitWorktree" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_workflow_template" FOREIGN KEY ("workflowTemplateId") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_agent_tool_config" FOREIGN KEY ("agentToolConfigId") REFERENCES "agent_tool_configs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "task_nodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "nodeOrder" integer NOT NULL, "name" character varying(160) NOT NULL, "nodeType" "public"."task_node_type_enum" NOT NULL, "input" jsonb, "output" jsonb, "requiresApproval" boolean NOT NULL DEFAULT false, "status" "public"."task_status_enum" NOT NULL DEFAULT 'todo', "attempt" integer NOT NULL DEFAULT 0, "errorCode" character varying(120), "errorMessage" text, "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "workerId" character varying(120), "leaseUntil" TIMESTAMP, "heartbeatAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_task_nodes_task_node_order" UNIQUE ("taskId", "nodeOrder"), CONSTRAINT "PK_task_nodes_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_task_id" ON "task_nodes" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_status" ON "task_nodes" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_status_lease_until" ON "task_nodes" ("status", "leaseUntil")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_task_status_order" ON "task_nodes" ("taskId", "status", "nodeOrder")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_nodes_single_in_progress" ON "task_nodes" ("taskId") WHERE "status" = 'in_progress'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD CONSTRAINT "FK_task_nodes_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "task_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "taskNodeId" uuid, "level" "public"."task_log_level_enum" NOT NULL DEFAULT 'info', "message" text NOT NULL, "payload" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_task_logs_id" PRIMARY KEY ("id"))`,
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

    await queryRunner.query(
      `CREATE TABLE "task_artifacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "taskNodeId" uuid, "artifactType" "public"."task_artifact_type_enum" NOT NULL, "name" character varying(200) NOT NULL, "downloadUrl" text, "content" text, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_task_artifacts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_artifacts_task_id" ON "task_artifacts" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_artifacts_task_node_id" ON "task_artifacts" ("taskNodeId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_artifacts" ADD CONSTRAINT "FK_task_artifacts_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_artifacts" ADD CONSTRAINT "FK_task_artifacts_task_node" FOREIGN KEY ("taskNodeId") REFERENCES "task_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "notification_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "emailEnabled" boolean NOT NULL DEFAULT false, "emailAddress" character varying(255), "webhookEnabled" boolean NOT NULL DEFAULT false, "webhookUrl" text, "browserEnabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_notification_settings_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_settings_user_id" ON "notification_settings" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_settings" ADD CONSTRAINT "FK_notification_settings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "notification_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "taskId" uuid, "eventType" character varying(120) NOT NULL, "title" character varying(200) NOT NULL, "content" text NOT NULL, "payload" jsonb, "readAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_notification_events_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_user_id" ON "notification_events" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_task_id" ON "notification_events" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_read_at" ON "notification_events" ("readAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_events" ADD CONSTRAINT "FK_notification_events_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_events" ADD CONSTRAINT "FK_notification_events_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "automations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "prompt" text NOT NULL, "rrule" character varying(255) NOT NULL, "cwds" jsonb, "status" character varying(20) NOT NULL DEFAULT 'active', "lastRunAt" TIMESTAMP, "nextRunAt" TIMESTAMP, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_automations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_name" ON "automations" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_status" ON "automations" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_created_by" ON "automations" ("createdBy")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_automations_name" ON "automations" ("name") WHERE "deletedAt" IS NULL`,
    );

    for (const item of TABLE_COMMENTS) {
      await this.setTableComment(queryRunner, item.table, item.comment);
    }

    for (const item of COLUMN_COMMENTS) {
      await this.setColumnComment(
        queryRunner,
        item.table,
        item.column,
        item.comment,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "automations"`);
    await queryRunner.query(`DROP TABLE "notification_events"`);
    await queryRunner.query(`DROP TABLE "notification_settings"`);
    await queryRunner.query(`DROP TABLE "task_artifacts"`);
    await queryRunner.query(`DROP TABLE "task_logs"`);
    await queryRunner.query(`DROP TABLE "task_nodes"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "workflow_templates"`);
    await queryRunner.query(`DROP TABLE "project_members"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TABLE "agent_tool_configs"`);
    await queryRunner.query(`DROP TABLE "business_line_invitations"`);
    await queryRunner.query(`DROP TABLE "business_line_members"`);
    await queryRunner.query(`DROP TABLE "business_lines"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(`DROP TYPE "public"."task_artifact_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_log_level_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_node_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_mode_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."workflow_template_scope_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."workflow_template_mode_enum"`);
    await queryRunner.query(`DROP TYPE "public"."project_member_role_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."business_line_member_role_enum"`,
    );
  }
}
