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
  { table: 'business_line_invitations', comment: '业务线邀请' },
  { table: 'agent_tool_configs', comment: '业务线工具配置' },
];

const COLUMN_COMMENTS: ColumnComment[] = [
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
  {
    table: 'agent_tool_configs',
    column: 'toolId',
    comment: '工具标识',
  },
  { table: 'agent_tool_configs', column: 'name', comment: '配置名称' },
  {
    table: 'agent_tool_configs',
    column: 'description',
    comment: '配置描述',
  },
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
  { table: 'workflow_templates', column: 'id', comment: '主键（UUID）' },
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
    table: 'workflow_templates',
    column: 'scope',
    comment: '模板作用域（全局/业务线）',
  },
  {
    table: 'workflow_templates',
    column: 'businessLineId',
    comment: '所属业务线ID（业务线作用域时填写）',
  },
  { table: 'tasks', column: 'businessLineId', comment: '所属业务线ID' },
  { table: 'tasks', column: 'prompt', comment: '任务提示词' },
  { table: 'tasks', column: 'gitBranch', comment: '任务Git分支名称' },
  {
    table: 'tasks',
    column: 'gitWorktree',
    comment: '任务Git工作树文件系统路径',
  },
  { table: 'tasks', column: 'cliToolId', comment: 'CLI工具标识' },
  {
    table: 'tasks',
    column: 'agentToolConfigId',
    comment: '关联工具配置ID',
  },
  {
    table: 'tasks',
    column: 'clientInputSnapshot',
    comment: '客户端输入快照JSON',
  },
];

export class AddMissingTableAndColumnComments1771003400000
  implements MigrationInterface
{
  name = 'AddMissingTableAndColumnComments1771003400000';

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
