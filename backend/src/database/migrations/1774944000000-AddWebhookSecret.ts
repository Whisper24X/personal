import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookSecret1774944000000 implements MigrationInterface {
  name = 'AddWebhookSecret1774944000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_settings" ADD "webhookSecret" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notification_settings"."webhookSecret" IS '飞书等平台 Webhook 签名密钥'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_settings" DROP COLUMN "webhookSecret"`,
    );
  }
}
