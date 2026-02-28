import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorUserEmailAndNotificationSettings1771002800000
  implements MigrationInterface
{
  name = 'RefactorUserEmailAndNotificationSettings1771002800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'notification_settings'
             AND column_name = 'inAppEnabled'
         ) THEN
           ALTER TABLE "notification_settings"
           RENAME COLUMN "inAppEnabled" TO "browserEnabled";
         END IF;
       END $$`,
    );

    await queryRunner.query(
      `ALTER TABLE "notification_settings"
       ADD COLUMN IF NOT EXISTS "emailAddress" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_settings"
       ALTER COLUMN "emailEnabled" SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_settings"
       ALTER COLUMN "browserEnabled" SET DEFAULT true`,
    );

    await queryRunner.query(
      `UPDATE "notification_settings" ns
       SET "emailAddress" = u."email"
       FROM "users" u
       WHERE ns."userId" = u."id"
         AND u."email" IS NOT NULL
         AND BTRIM(u."email") <> ''
         AND (ns."emailAddress" IS NULL OR BTRIM(ns."emailAddress") = '')`,
    );

    await queryRunner.query(
      `INSERT INTO "notification_settings"
       ("id", "userId", "emailEnabled", "emailAddress", "webhookEnabled", "webhookUrl", "browserEnabled", "createdAt", "updatedAt")
       SELECT
         gen_random_uuid(),
         u."id",
         true,
         u."email",
         false,
         NULL,
         true,
         now(),
         now()
       FROM "users" u
       LEFT JOIN "notification_settings" ns ON ns."userId" = u."id"
       WHERE ns."id" IS NULL
         AND u."email" IS NOT NULL
         AND BTRIM(u."email") <> ''`,
    );

    await queryRunner.query(
      `UPDATE "notification_settings"
       SET "emailEnabled" = false
       WHERE "emailAddress" IS NULL
          OR BTRIM("emailAddress") = ''`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_users_email"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" character varying(255)`,
    );

    await queryRunner.query(
      `UPDATE "users" u
       SET "email" = ns."emailAddress"
       FROM "notification_settings" ns
       WHERE ns."userId" = u."id"
         AND ns."emailAddress" IS NOT NULL
         AND BTRIM(ns."emailAddress") <> ''`,
    );

    await queryRunner.query(
      `WITH duplicate_emails AS (
         SELECT
           "id",
           ROW_NUMBER() OVER (
             PARTITION BY LOWER("email")
             ORDER BY "createdAt", "id"
           ) AS row_num
         FROM "users"
         WHERE "email" IS NOT NULL
           AND BTRIM("email") <> ''
       )
       UPDATE "users" u
       SET "email" = NULL
       FROM duplicate_emails d
       WHERE u."id" = d."id"
         AND d.row_num > 1`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_settings"
       ALTER COLUMN "emailEnabled" SET DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_settings"
       ALTER COLUMN "browserEnabled" SET DEFAULT true`,
    );

    await queryRunner.query(
      `ALTER TABLE "notification_settings" DROP COLUMN IF EXISTS "emailAddress"`,
    );

    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'notification_settings'
             AND column_name = 'browserEnabled'
         ) THEN
           ALTER TABLE "notification_settings"
           RENAME COLUMN "browserEnabled" TO "inAppEnabled";
         END IF;
       END $$`,
    );
  }
}
