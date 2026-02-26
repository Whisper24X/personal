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
  { table: 'role', comment: '用户角色字典（历史表）' },
  { table: 'status', comment: '用户状态字典（历史表）' },
  { table: 'session', comment: '用户登录会话' },
  { table: 'business_lines', comment: '业务线' },
  { table: 'business_line_members', comment: '业务线成员' },
  { table: 'users', comment: '系统用户' },
  { table: 'projects', comment: '业务线下项目' },
  { table: 'project_members', comment: '项目成员' },
  { table: 'workflow_templates', comment: '工作流模板' },
  {
    table: 'workflow_template_versions',
    comment: '已发布工作流模板版本',
  },
  { table: 'tasks', comment: '执行任务' },
  { table: 'task_nodes', comment: '任务执行节点' },
  { table: 'task_logs', comment: '任务执行日志' },
  {
    table: 'task_artifacts',
    comment: '任务执行产生的工件',
  },
  {
    table: 'notification_settings',
    comment: '用户通知偏好设置',
  },
  { table: 'notification_events', comment: '用户通知事件' },
  { table: 'skills', comment: '已安装技能目录' },
  { table: 'mcps', comment: '已安装MCP目录' },
  { table: 'automations', comment: '定时自动化定义' },
];

const COLUMN_COMMENTS: ColumnComment[] = [
  { table: 'role', column: 'id', comment: '主键' },
  { table: 'role', column: 'name', comment: '角色名称' },
  { table: 'status', column: 'id', comment: '主键' },
  { table: 'status', column: 'name', comment: '状态名称' },
  { table: 'session', column: 'id', comment: '主键' },
  { table: 'session', column: 'hash', comment: '会话哈希令牌' },
  { table: 'session', column: 'createdAt', comment: '创建时间' },
  { table: 'session', column: 'updatedAt', comment: '更新时间' },
  { table: 'session', column: 'deletedAt', comment: '软删除时间' },
  { table: 'session', column: 'userId', comment: '关联用户ID' },
  { table: 'business_lines', column: 'id', comment: '主键（UUID）' },
  { table: 'business_lines', column: 'name', comment: '业务线名称' },
  {
    table: 'business_lines',
    column: 'description',
    comment: '业务线描述',
  },
  {
    table: 'business_lines',
    column: 'createdAt',
    comment: '创建时间',
  },
  {
    table: 'business_lines',
    column: 'updatedAt',
    comment: '更新时间',
  },
  {
    table: 'business_lines',
    column: 'deletedAt',
    comment: '软删除时间',
  },
  {
    table: 'business_line_members',
    column: 'id',
    comment: '主键（UUID）',
  },
  {
    table: 'business_line_members',
    column: 'businessLineId',
    comment: '关联业务线ID',
  },
  {
    table: 'business_line_members',
    column: 'userId',
    comment: '关联用户ID',
  },
  { table: 'business_line_members', column: 'role', comment: '成员角色' },
  {
    table: 'business_line_members',
    column: 'createdAt',
    comment: '创建时间',
  },
  {
    table: 'business_line_members',
    column: 'updatedAt',
    comment: '更新时间',
  },
  { table: 'users', column: 'id', comment: '主键（UUID）' },
  { table: 'users', column: 'username', comment: '登录用户名' },
  { table: 'users', column: 'email', comment: '邮箱地址' },
  { table: 'users', column: 'password', comment: '加密密码' },
  { table: 'users', column: 'salt', comment: '密码盐' },
  { table: 'users', column: 'nickname', comment: '显示昵称' },
  { table: 'users', column: 'avatar', comment: '头像地址' },
  { table: 'users', column: 'isAdmin', comment: '是否管理员' },
  { table: 'users', column: 'status', comment: '用户状态码' },
  {
    table: 'users',
    column: 'legacyId',
    comment: '用于迁移映射的历史整型用户ID',
  },
  { table: 'users', column: 'createdAt', comment: '创建时间' },
  { table: 'users', column: 'updatedAt', comment: '更新时间' },
  { table: 'users', column: 'deletedAt', comment: '软删除时间' },
  { table: 'projects', column: 'id', comment: '主键（UUID）' },
  {
    table: 'projects',
    column: 'businessLineId',
    comment: '所属业务线ID',
  },
  { table: 'projects', column: 'name', comment: '项目名称' },
  { table: 'projects', column: 'description', comment: '项目描述' },
  { table: 'projects', column: 'gitUrl', comment: 'Git仓库地址' },
  {
    table: 'projects',
    column: 'defaultBranch',
    comment: '默认仓库分支',
  },
  {
    table: 'projects',
    column: 'configJson',
    comment: '项目配置JSON',
  },
  { table: 'projects', column: 'createdAt', comment: '创建时间' },
  { table: 'projects', column: 'updatedAt', comment: '更新时间' },
  { table: 'projects', column: 'deletedAt', comment: '软删除时间' },
  { table: 'project_members', column: 'id', comment: '主键（UUID）' },
  {
    table: 'project_members',
    column: 'projectId',
    comment: '关联项目ID',
  },
  { table: 'project_members', column: 'userId', comment: '关联用户ID' },
  { table: 'project_members', column: 'role', comment: '项目成员角色' },
  {
    table: 'project_members',
    column: 'createdAt',
    comment: '创建时间',
  },
  {
    table: 'project_members',
    column: 'updatedAt',
    comment: '更新时间',
  },
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
    column: 'isActive',
    comment: '模板是否启用',
  },
  {
    table: 'workflow_templates',
    column: 'latestVersion',
    comment: '最新发布版本',
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
  {
    table: 'workflow_template_versions',
    column: 'id',
    comment: '主键（UUID）',
  },
  {
    table: 'workflow_template_versions',
    column: 'templateId',
    comment: '关联模板ID',
  },
  {
    table: 'workflow_template_versions',
    column: 'version',
    comment: '模板版本号',
  },
  {
    table: 'workflow_template_versions',
    column: 'name',
    comment: '版本显示名称',
  },
  {
    table: 'workflow_template_versions',
    column: 'description',
    comment: '版本描述',
  },
  {
    table: 'workflow_template_versions',
    column: 'mode',
    comment: '模板模式',
  },
  {
    table: 'workflow_template_versions',
    column: 'nodesJson',
    comment: '版本工作流节点JSON',
  },
  {
    table: 'workflow_template_versions',
    column: 'publishedBy',
    comment: '发布者用户ID',
  },
  {
    table: 'workflow_template_versions',
    column: 'createdAt',
    comment: '创建时间',
  },
  { table: 'tasks', column: 'id', comment: '主键（UUID）' },
  { table: 'tasks', column: 'projectId', comment: '关联项目ID' },
  {
    table: 'tasks',
    column: 'workflowTemplateId',
    comment: '关联工作流模板ID',
  },
  {
    table: 'tasks',
    column: 'workflowTemplateVersion',
    comment: '任务使用的工作流模板版本',
  },
  { table: 'tasks', column: 'mode', comment: '任务模式' },
  { table: 'tasks', column: 'title', comment: '任务标题' },
  { table: 'tasks', column: 'description', comment: '任务描述' },
  {
    table: 'tasks',
    column: 'acceptanceCriteria',
    comment: '任务验收标准JSON',
  },
  { table: 'tasks', column: 'status', comment: '任务状态' },
  { table: 'tasks', column: 'branch', comment: '任务Git分支名称' },
  {
    table: 'tasks',
    column: 'gitBaseBranch',
    comment: '任务工作树基线分支',
  },
  {
    table: 'tasks',
    column: 'gitWorktreePath',
    comment: '任务Git工作树文件系统路径',
  },
  {
    table: 'tasks',
    column: 'sandboxCleanupAt',
    comment: '沙箱清理计划时间',
  },
  {
    table: 'tasks',
    column: 'environment',
    comment: '运行环境名称',
  },
  {
    table: 'tasks',
    column: 'toolVersionsSnapshot',
    comment: '工具版本快照JSON',
  },
  { table: 'tasks', column: 'createdBy', comment: '创建者用户ID' },
  {
    table: 'tasks',
    column: 'startedAt',
    comment: '任务执行开始时间',
  },
  {
    table: 'tasks',
    column: 'finishedAt',
    comment: '任务执行结束时间',
  },
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
  {
    table: 'task_nodes',
    column: 'startedAt',
    comment: '节点执行开始时间',
  },
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
  {
    table: 'task_nodes',
    column: 'leaseUntil',
    comment: '租约过期时间',
  },
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
  {
    table: 'task_logs',
    column: 'payload',
    comment: '结构化日志载荷JSON',
  },
  { table: 'task_logs', column: 'createdAt', comment: '创建时间' },
  { table: 'task_artifacts', column: 'id', comment: '主键（UUID）' },
  { table: 'task_artifacts', column: 'taskId', comment: '关联任务ID' },
  {
    table: 'task_artifacts',
    column: 'taskNodeId',
    comment: '关联任务节点ID',
  },
  { table: 'task_artifacts', column: 'artifactType', comment: '工件类型' },
  { table: 'task_artifacts', column: 'name', comment: '工件名称' },
  {
    table: 'task_artifacts',
    column: 'downloadUrl',
    comment: '工件下载地址',
  },
  {
    table: 'task_artifacts',
    column: 'content',
    comment: '内联工件内容',
  },
  {
    table: 'task_artifacts',
    column: 'metadata',
    comment: '工件元数据JSON',
  },
  {
    table: 'task_artifacts',
    column: 'createdAt',
    comment: '创建时间',
  },
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
    column: 'inAppEnabled',
    comment: '是否启用站内通知',
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
  {
    table: 'notification_events',
    column: 'title',
    comment: '通知标题',
  },
  {
    table: 'notification_events',
    column: 'content',
    comment: '通知内容',
  },
  {
    table: 'notification_events',
    column: 'payload',
    comment: '通知载荷JSON',
  },
  {
    table: 'notification_events',
    column: 'readAt',
    comment: '已读时间',
  },
  {
    table: 'notification_events',
    column: 'createdAt',
    comment: '创建时间',
  },
  { table: 'skills', column: 'id', comment: '主键（UUID）' },
  { table: 'skills', column: 'name', comment: '技能名称' },
  { table: 'skills', column: 'version', comment: '技能版本' },
  { table: 'skills', column: 'description', comment: '技能描述' },
  { table: 'skills', column: 'scope', comment: '技能范围' },
  { table: 'skills', column: 'homepage_url', comment: '技能主页地址' },
  { table: 'skills', column: 'metadata_json', comment: '技能元数据JSON' },
  { table: 'skills', column: 'enabled', comment: '技能是否启用' },
  { table: 'skills', column: 'created_at', comment: '创建时间' },
  { table: 'skills', column: 'updated_at', comment: '更新时间' },
  { table: 'skills', column: 'deleted_at', comment: '软删除时间' },
  { table: 'mcps', column: 'id', comment: '主键（UUID）' },
  { table: 'mcps', column: 'name', comment: 'MCP名称' },
  { table: 'mcps', column: 'version', comment: 'MCP版本' },
  { table: 'mcps', column: 'description', comment: 'MCP描述' },
  { table: 'mcps', column: 'provider', comment: 'MCP提供方' },
  {
    table: 'mcps',
    column: 'tools_count',
    comment: 'MCP暴露工具数量',
  },
  { table: 'mcps', column: 'config_schema', comment: 'MCP配置结构JSON' },
  { table: 'mcps', column: 'metadata_json', comment: 'MCP元数据JSON' },
  { table: 'mcps', column: 'enabled', comment: 'MCP是否启用' },
  { table: 'mcps', column: 'created_at', comment: '创建时间' },
  { table: 'mcps', column: 'updated_at', comment: '更新时间' },
  { table: 'mcps', column: 'deleted_at', comment: '软删除时间' },
  { table: 'automations', column: 'id', comment: '主键（UUID）' },
  { table: 'automations', column: 'name', comment: '自动化名称' },
  {
    table: 'automations',
    column: 'prompt',
    comment: '自动化提示词内容',
  },
  {
    table: 'automations',
    column: 'rrule',
    comment: '自动化调度规则',
  },
  {
    table: 'automations',
    column: 'cwds',
    comment: '工作目录列表(JSON)',
  },
  { table: 'automations', column: 'status', comment: '自动化状态' },
  {
    table: 'automations',
    column: 'lastRunAt',
    comment: '最近执行时间',
  },
  {
    table: 'automations',
    column: 'nextRunAt',
    comment: '下次执行时间',
  },
  {
    table: 'automations',
    column: 'createdBy',
    comment: '创建者用户ID',
  },
  { table: 'automations', column: 'createdAt', comment: '创建时间' },
  { table: 'automations', column: 'updatedAt', comment: '更新时间' },
  {
    table: 'automations',
    column: 'deletedAt',
    comment: '软删除时间',
  },
];

export class AddTableAndColumnComments1771002700000
  implements MigrationInterface
{
  name = 'AddTableAndColumnComments1771002700000';

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
    for (const item of COLUMN_COMMENTS) {
      await this.setColumnComment(queryRunner, item.table, item.column, null);
    }

    for (const item of TABLE_COMMENTS) {
      await this.setTableComment(queryRunner, item.table, null);
    }
  }
}
