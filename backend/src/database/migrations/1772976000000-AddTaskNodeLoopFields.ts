import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskNodeLoopFields1772976000000 implements MigrationInterface {
  name = 'AddTaskNodeLoopFields1772976000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('task_nodes'))) {
      return;
    }

    if (await queryRunner.hasColumn('task_nodes', 'attempt')) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" RENAME COLUMN "attempt" TO "loopCount"`,
      );
    }

    if (!(await queryRunner.hasColumn('task_nodes', 'loopCount'))) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" ADD COLUMN "loopCount" integer NOT NULL DEFAULT 0`,
      );
    }

    if (!(await queryRunner.hasColumn('task_nodes', 'maxLoops'))) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" ADD COLUMN "maxLoops" integer NOT NULL DEFAULT 1`,
      );
    }

    await queryRunner.query(`
      UPDATE "task_nodes" AS node
      SET "loopCount" = GREATEST(COALESCE(node."loopCount", 0), 0),
          "maxLoops" = GREATEST(
            COALESCE(
              CASE
                WHEN jsonb_typeof(node."input" -> 'maxLoops') = 'number'
                  THEN (node."input" ->> 'maxLoops')::int
                WHEN jsonb_typeof(node."input" -> 'maxLoops') = 'string'
                  AND BTRIM(node."input" ->> 'maxLoops') ~ '^[0-9]+$'
                  THEN (node."input" ->> 'maxLoops')::int
                ELSE NULL
              END,
              CASE
                WHEN jsonb_typeof(task."configJson" -> 'maxLoops') = 'number'
                  THEN (task."configJson" ->> 'maxLoops')::int
                WHEN jsonb_typeof(task."configJson" -> 'maxLoops') = 'string'
                  AND BTRIM(task."configJson" ->> 'maxLoops') ~ '^[0-9]+$'
                  THEN (task."configJson" ->> 'maxLoops')::int
                ELSE NULL
              END,
              node."maxLoops",
              1
            ),
            1
          )
      FROM "tasks" AS task
      WHERE task."id" = node."taskId"
    `);

    await queryRunner.query(`
      UPDATE "task_nodes"
      SET "input" = NULLIF(
        jsonb_strip_nulls(COALESCE("input", '{}'::jsonb) - 'maxLoops'),
        '{}'::jsonb
      )
      WHERE "input" IS NOT NULL
        AND "input" ? 'maxLoops'
    `);

    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "loopCount" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "maxLoops" SET DEFAULT 1`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."loopCount" IS '已完成循环次数'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."maxLoops" IS '最大循环次数'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('task_nodes'))) {
      return;
    }

    if (await queryRunner.hasColumn('task_nodes', 'maxLoops')) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" DROP COLUMN "maxLoops"`,
      );
    }

    if (await queryRunner.hasColumn('task_nodes', 'loopCount')) {
      await queryRunner.query(
        `COMMENT ON COLUMN "task_nodes"."loopCount" IS '重试次数'`,
      );
      await queryRunner.query(
        `ALTER TABLE "task_nodes" RENAME COLUMN "loopCount" TO "attempt"`,
      );
    }
  }
}
