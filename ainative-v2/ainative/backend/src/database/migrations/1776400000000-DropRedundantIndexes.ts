import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropRedundantIndexes1776400000000 implements MigrationInterface {
  name = 'DropRedundantIndexes1776400000000';

  private readonly redundantStandaloneUniqueIndexes = [
    'PK_c78a5a8e8c260d468f162d1bb3a',
    'PK_34c2cc382fc780ea36f7c478192',
    'PK_2cd94765894fc2895c60732725b',
    'PK_5380ba4309f72e01608061dccf0',
    'PK_97a877b75b8db5f5fafa1824dfd',
    'PK_c2d8ed0937c0e59c345ffe486d3',
    'PK_8c82d7f526340ab734260ea46be',
    'PK_5b828caf9bd52c7e580f5768b14',
    'PK_d131abd7996c475ef768d4559ba',
    'PK_0b2f46f804be4aea9234c78bcc9',
    'PK_8ac6a6996b6eaeae7b8fbb669f1',
    'PK_6271df0a7aed1d6c0691ce6ac50',
    'PK_389cdd6e0626609626f572c2877',
    'PK_8d12ff38fcc62aaba2cab748772',
    'PK_a3ffb1c0c8416b9fc6f907b7433',
    'PK_de336a1fce23ad3261d49423eae',
    'PK_goals',
    'PK_goal_source_docs',
    'PK_goal_plan_items',
    'PK_goal_plan_sub_tasks',
    'PK_task_dependencies',
    'PK_project_execution_slots',
  ];

  private readonly redundantRegularIndexes = [
    'IDX_project_execution_slots_task',
    'IDX_business_line_member_business_line_id',
    'IDX_project_members_project_id',
    'IDX_agent_cli_config_business_line_id',
    'IDX_task_nodes_task_id',
    'IDX_workflow_templates_name',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const indexName of this.redundantStandaloneUniqueIndexes) {
      await queryRunner.query(this.dropIndexIfNotConstraintSql(indexName));
    }

    for (const indexName of this.redundantRegularIndexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "public"."${indexName}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_c78a5a8e8c260d468f162d1bb3a" ON "agent_cli_configs" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_34c2cc382fc780ea36f7c478192" ON "automations" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_2cd94765894fc2895c60732725b" ON "business_line_invitations" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_5380ba4309f72e01608061dccf0" ON "business_line_members" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_97a877b75b8db5f5fafa1824dfd" ON "business_line_roles" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_c2d8ed0937c0e59c345ffe486d3" ON "business_lines" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_8c82d7f526340ab734260ea46be" ON "migrations" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_5b828caf9bd52c7e580f5768b14" ON "notification_events" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_d131abd7996c475ef768d4559ba" ON "notification_settings" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_0b2f46f804be4aea9234c78bcc9" ON "project_members" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_8ac6a6996b6eaeae7b8fbb669f1" ON "project_roles" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_6271df0a7aed1d6c0691ce6ac50" ON "projects" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_389cdd6e0626609626f572c2877" ON "task_nodes" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_8d12ff38fcc62aaba2cab748772" ON "tasks" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_a3ffb1c0c8416b9fc6f907b7433" ON "users" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_de336a1fce23ad3261d49423eae" ON "workflow_templates" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_goals" ON "goals" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_goal_source_docs" ON "goal_source_docs" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_goal_plan_items" ON "goal_plan_items" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_goal_plan_sub_tasks" ON "goal_plan_sub_tasks" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_task_dependencies" ON "task_dependencies" ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PK_project_execution_slots" ON "project_execution_slots" ("id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_execution_slots_task" ON "project_execution_slots" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_business_line_member_business_line_id" ON "business_line_members" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_members_project_id" ON "project_members" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_cli_config_business_line_id" ON "agent_cli_configs" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_nodes_task_id" ON "task_nodes" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workflow_templates_name" ON "workflow_templates" ("name")`,
    );
  }

  private dropIndexIfNotConstraintSql(indexName: string): string {
    return `
      DO $$
      DECLARE
        index_oid regclass;
      BEGIN
        index_oid := to_regclass('public."${indexName}"');
        IF index_oid IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conindid = index_oid
          )
        THEN
          EXECUTE 'DROP INDEX "public"."${indexName}"';
        END IF;
      END
      $$;
    `;
  }
}
