import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignUsersWithAINativeSpec1771001000000
  implements MigrationInterface
{
  name = 'AlignUsersWithAINativeSpec1771001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(100) NOT NULL, "password" character varying NOT NULL, "salt" character varying, "nickname" character varying, "avatar" character varying, "isAdmin" boolean NOT NULL DEFAULT false, "status" integer NOT NULL DEFAULT 1, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_username" ON "users" ("username")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_username" ON "users" ("username")`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "legacyId" integer`,
    );

    await queryRunner.query(
      `INSERT INTO "users" ("username", "password", "salt", "nickname", "avatar", "isAdmin", "status", "createdAt", "updatedAt", "deletedAt", "legacyId")
       SELECT
         COALESCE("email", 'legacy_user_' || "id"::text),
         COALESCE("password", ''),
         NULL,
         TRIM(CONCAT(COALESCE("firstName", ''), ' ', COALESCE("lastName", ''))),
         NULL,
         false,
         1,
         "createdAt",
         "updatedAt",
         "deletedAt",
         "id"
       FROM "user"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_legacy_id" ON "users" ("legacyId") WHERE "legacyId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT IF EXISTS "FK_8c839fcb74f5387cf9c953e8e5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN "userIdNew" uuid`,
    );

    await queryRunner.query(
      `UPDATE "business_line_members" blm
       SET "userIdNew" = u."id"
       FROM "users" u
       WHERE u."legacyId" = blm."userId"`,
    );

    await queryRunner.query(
      `DELETE FROM "business_line_members" WHERE "userIdNew" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT IF EXISTS "UQ_business_line_member_business_line_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_business_line_member_user_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP COLUMN "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" RENAME COLUMN "userIdNew" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ALTER COLUMN "userId" SET NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_user_id" ON "business_line_members" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "UQ_business_line_member_business_line_user" UNIQUE ("businessLineId", "userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_8c839fcb74f5387cf9c953e8e5a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "FK_3d2f174ef04fb312fdebd0ddc53"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_3d2f174ef04fb312fdebd0ddc5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD COLUMN "userIdNew" uuid`,
    );
    await queryRunner.query(
      `UPDATE "session" s
       SET "userIdNew" = u."id"
       FROM "users" u
       WHERE u."legacyId" = s."userId"`,
    );
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "userId"`);
    await queryRunner.query(
      `ALTER TABLE "session" RENAME COLUMN "userIdNew" TO "userId"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d2f174ef04fb312fdebd0ddc5" ON "session" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying, "password" character varying, "firstName" character varying, "lastName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_e12875dfb3b1d92d7d7c5377e22" ON "user" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName")`,
    );

    await queryRunner.query(
      `INSERT INTO "user" ("id", "email", "password", "firstName", "lastName", "createdAt", "updatedAt", "deletedAt")
       SELECT
         "legacyId",
         "username",
         "password",
         split_part(COALESCE("nickname", ''), ' ', 1),
         NULLIF(substr(COALESCE("nickname", ''), length(split_part(COALESCE("nickname", ''), ' ', 1)) + 2), ''),
         "createdAt",
         "updatedAt",
         "deletedAt"
       FROM "users"
       WHERE "legacyId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "FK_3d2f174ef04fb312fdebd0ddc53"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_3d2f174ef04fb312fdebd0ddc5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD COLUMN "userIdOld" integer`,
    );
    await queryRunner.query(
      `UPDATE "session" s
       SET "userIdOld" = u."legacyId"
       FROM "users" u
       WHERE u."id" = s."userId"`,
    );
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "userId"`);
    await queryRunner.query(
      `ALTER TABLE "session" RENAME COLUMN "userIdOld" TO "userId"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d2f174ef04fb312fdebd0ddc5" ON "session" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT IF EXISTS "FK_8c839fcb74f5387cf9c953e8e5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT IF EXISTS "UQ_business_line_member_business_line_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_business_line_member_user_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN "userIdOld" integer`,
    );
    await queryRunner.query(
      `UPDATE "business_line_members" blm
       SET "userIdOld" = u."legacyId"
       FROM "users" u
       WHERE u."id" = blm."userId"`,
    );
    await queryRunner.query(
      `DELETE FROM "business_line_members" WHERE "userIdOld" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP COLUMN "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" RENAME COLUMN "userIdOld" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_user_id" ON "business_line_members" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "UQ_business_line_member_business_line_user" UNIQUE ("businessLineId", "userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_8c839fcb74f5387cf9c953e8e5a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_users_legacy_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_users_username"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_users_username"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
