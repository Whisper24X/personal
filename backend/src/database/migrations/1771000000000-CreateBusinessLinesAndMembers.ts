import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessLinesAndMembers1771000000000
  implements MigrationInterface
{
  name = 'CreateBusinessLinesAndMembers1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."business_line_member_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );

    await queryRunner.query(
      `CREATE TABLE "business_lines" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(100) NOT NULL, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_845f61f2f22fdbaf07e1f6f96df" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_business_lines_name" ON "business_lines" ("name")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uniq_business_lines_name" ON "business_lines" ("name") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "business_line_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "businessLineId" uuid NOT NULL, "userId" integer NOT NULL, "role" "public"."business_line_member_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_business_line_member_business_line_user" UNIQUE ("businessLineId", "userId"), CONSTRAINT "PK_405f98b8aef46a3fffb7f7ff0e8" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_business_line_id" ON "business_line_members" ("businessLineId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_user_id" ON "business_line_members" ("userId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_24a94f6f73f654487b7bbf3648f" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_8c839fcb74f5387cf9c953e8e5a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT "FK_8c839fcb74f5387cf9c953e8e5a"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT "FK_24a94f6f73f654487b7bbf3648f"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_member_user_id"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_member_business_line_id"`,
    );

    await queryRunner.query(`DROP TABLE "business_line_members"`);

    await queryRunner.query(`DROP INDEX "public"."uniq_business_lines_name"`);

    await queryRunner.query(`DROP INDEX "public"."idx_business_lines_name"`);

    await queryRunner.query(`DROP TABLE "business_lines"`);

    await queryRunner.query(
      `DROP TYPE "public"."business_line_member_role_enum"`,
    );
  }
}
