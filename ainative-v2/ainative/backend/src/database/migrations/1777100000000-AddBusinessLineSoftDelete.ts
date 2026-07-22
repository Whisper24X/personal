import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessLineSoftDelete1777100000000
  implements MigrationInterface
{
  name = 'AddBusinessLineSoftDelete1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_lines" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_lines"."deletedAt" IS '软删除时间'`,
    );

    // 修复唯一名称索引：从全表唯一改为仅对未删除记录唯一
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_business_lines_name"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_business_lines_name" ON "business_lines" ("name") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_business_lines_name"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_business_lines_name" ON "business_lines" ("name")`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_lines" DROP COLUMN IF EXISTS "deletedAt"`,
    );
  }
}
