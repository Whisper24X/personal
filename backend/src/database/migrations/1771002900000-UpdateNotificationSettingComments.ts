import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateNotificationSettingComments1771002900000
  implements MigrationInterface
{
  name = 'UpdateNotificationSettingComments1771002900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'users'
             AND column_name = 'email'
         ) THEN
           COMMENT ON COLUMN "users"."email" IS NULL;
         END IF;
       END $$`,
    );

    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'notification_settings'
             AND column_name = 'emailAddress'
         ) THEN
           COMMENT ON COLUMN "notification_settings"."emailAddress" IS '通知邮箱地址';
         END IF;
       END $$`,
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
           COMMENT ON COLUMN "notification_settings"."browserEnabled" IS '是否启用浏览器通知';
         END IF;
       END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
           COMMENT ON COLUMN "notification_settings"."browserEnabled" IS NULL;
         END IF;
       END $$`,
    );

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
           COMMENT ON COLUMN "notification_settings"."inAppEnabled" IS '是否启用站内通知';
         END IF;
       END $$`,
    );

    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'users'
             AND column_name = 'email'
         ) THEN
           COMMENT ON COLUMN "users"."email" IS '邮箱地址';
         END IF;
       END $$`,
    );
  }
}
