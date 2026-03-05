import { MigrationInterface, QueryRunner } from 'typeorm';

type ColumnComment = {
  column: string;
  comment: string;
};

const WORKFLOW_TEMPLATE_TABLE_COMMENT = '工作流模板';

const WORKFLOW_TEMPLATE_COLUMN_COMMENTS: ColumnComment[] = [
  { column: 'id', comment: '主键（UUID）' },
  { column: 'name', comment: '模板名称' },
  { column: 'description', comment: '模板描述' },
  { column: 'mode', comment: '模板模式' },
  { column: 'scope', comment: '模板作用域（全局/业务线）' },
  {
    column: 'businessLineId',
    comment: '所属业务线ID（业务线作用域时填写）',
  },
  { column: 'isActive', comment: '模板是否启用' },
  { column: 'latestVersion', comment: '最新发布版本' },
  { column: 'nodesJson', comment: '模板工作流节点JSON' },
  { column: 'createdBy', comment: '创建者用户ID' },
  { column: 'createdAt', comment: '创建时间' },
  { column: 'updatedAt', comment: '更新时间' },
  { column: 'deletedAt', comment: '软删除时间' },
];

export class EnsureWorkflowTemplateComments1771003500000
  implements MigrationInterface
{
  name = 'EnsureWorkflowTemplateComments1771003500000';

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
    const tableName = 'workflow_templates';

    await this.setTableComment(
      queryRunner,
      tableName,
      WORKFLOW_TEMPLATE_TABLE_COMMENT,
    );

    for (const item of WORKFLOW_TEMPLATE_COLUMN_COMMENTS) {
      await this.setColumnComment(
        queryRunner,
        tableName,
        item.column,
        item.comment,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'workflow_templates';

    for (const item of WORKFLOW_TEMPLATE_COLUMN_COMMENTS) {
      await this.setColumnComment(queryRunner, tableName, item.column, null);
    }

    await this.setTableComment(queryRunner, tableName, null);
  }
}
