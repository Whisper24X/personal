import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveTaskClientInputSnapshotIntoConfigJson1772965000000
  implements MigrationInterface
{
  name = 'MoveTaskClientInputSnapshotIntoConfigJson1772965000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "tasks"
       SET "configJson" = NULLIF(
         jsonb_strip_nulls(
           (COALESCE("clientInputSnapshot", '{}'::jsonb) - 'mode') ||
           COALESCE("configJson", '{}'::jsonb)
         ),
         '{}'::jsonb
       )
       WHERE "clientInputSnapshot" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "clientInputSnapshot"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "clientInputSnapshot" jsonb`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."clientInputSnapshot" IS '客户端输入快照JSON'`,
    );

    await queryRunner.query(
      `UPDATE "tasks"
       SET "clientInputSnapshot" = NULLIF(
         jsonb_strip_nulls(
           jsonb_build_object(
             'mode', "mode",
             'workflowTemplateId', "configJson" -> 'workflowTemplateId',
             'cliToolId', "configJson" -> 'cliToolId',
             'agentToolConfigId', "configJson" -> 'agentToolConfigId',
             'attachments', "configJson" -> 'attachments'
           )
         ),
         '{}'::jsonb
       )`,
    );
  }
}
