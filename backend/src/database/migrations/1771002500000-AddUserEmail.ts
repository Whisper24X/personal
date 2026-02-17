import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmail1771002500000 implements MigrationInterface {
  name = 'AddUserEmail1771002500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" character varying(255)`,
    );
    await queryRunner.query(
      `UPDATE "users"
       SET "email" = "username"
       WHERE "email" IS NULL
         AND POSITION('@' IN "username") > 1`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_users_email"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`,
    );
  }
}
