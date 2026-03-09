import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveTaskNodeLoopFieldsIntoJson1772977000000
  implements MigrationInterface
{
  name = 'MoveTaskNodeLoopFieldsIntoJson1772977000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('task_nodes'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('task_nodes', 'loopJson'))) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" ADD COLUMN "loopJson" jsonb`,
      );
    }

    await queryRunner.query(`
      UPDATE "task_nodes"
      SET "loopJson" = jsonb_build_object(
        'enabled', CASE
          WHEN COALESCE("maxLoops", 1) > 1 THEN true
          ELSE false
        END,
        'loopCount', GREATEST(COALESCE("loopCount", 0), 0),
        'maxLoops', GREATEST(COALESCE("maxLoops", 1), 1)
      )
      WHERE "loopJson" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "task_nodes"
      SET "loopJson" = jsonb_strip_nulls(COALESCE("loopJson", '{}'::jsonb))
      WHERE "loopJson" IS NOT NULL
    `);

    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."loopJson" IS '循环执行配置JSON'`,
    );

    if (await queryRunner.hasColumn('task_nodes', 'loopCount')) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" DROP COLUMN "loopCount"`,
      );
    }

    if (await queryRunner.hasColumn('task_nodes', 'maxLoops')) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" DROP COLUMN "maxLoops"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('task_nodes'))) {
      return;
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
      UPDATE "task_nodes"
      SET "loopCount" = GREATEST(
            COALESCE(
              CASE
                WHEN jsonb_typeof("loopJson" -> 'loopCount') = 'number'
                  THEN ("loopJson" ->> 'loopCount')::int
                WHEN jsonb_typeof("loopJson" -> 'loopCount') = 'string'
                  AND BTRIM("loopJson" ->> 'loopCount') ~ '^[0-9]+$'
                  THEN ("loopJson" ->> 'loopCount')::int
                ELSE 0
              END,
              0
            ),
            0
          ),
          "maxLoops" = GREATEST(
            COALESCE(
              CASE
                WHEN jsonb_typeof("loopJson" -> 'maxLoops') = 'number'
                  THEN ("loopJson" ->> 'maxLoops')::int
                WHEN jsonb_typeof("loopJson" -> 'maxLoops') = 'string'
                  AND BTRIM("loopJson" ->> 'maxLoops') ~ '^[0-9]+$'
                  THEN ("loopJson" ->> 'maxLoops')::int
                ELSE 1
              END,
              1
            ),
            1
          )
    `);

    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."loopCount" IS '已完成循环次数'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."maxLoops" IS '最大循环次数'`,
    );

    if (await queryRunner.hasColumn('task_nodes', 'loopJson')) {
      await queryRunner.query(
        `ALTER TABLE "task_nodes" DROP COLUMN "loopJson"`,
      );
    }
  }
}
