import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskArtifactsAndNotifications1771002100000
  implements MigrationInterface
{
  name = 'CreateTaskArtifactsAndNotifications1771002100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."task_artifact_type_enum" AS ENUM('diff', 'report', 'file', 'preview')`,
    );

    await queryRunner.query(
      `CREATE TABLE "task_artifacts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "taskId" uuid NOT NULL, "taskNodeId" uuid, "artifactType" "public"."task_artifact_type_enum" NOT NULL, "name" character varying(200) NOT NULL, "downloadUrl" text, "content" text, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c0c5d5f2dd29a70a7e3b955e6f3" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_task_artifacts_task_id" ON "task_artifacts" ("taskId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_task_artifacts_task_node_id" ON "task_artifacts" ("taskNodeId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_artifacts" ADD CONSTRAINT "FK_task_artifacts_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_artifacts" ADD CONSTRAINT "FK_task_artifacts_task_node" FOREIGN KEY ("taskNodeId") REFERENCES "task_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "notification_settings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "emailEnabled" boolean NOT NULL DEFAULT true, "webhookEnabled" boolean NOT NULL DEFAULT false, "webhookUrl" text, "inAppEnabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8c847f30ee24557b05296f40f4f" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_settings_user_id" ON "notification_settings" ("userId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "notification_settings" ADD CONSTRAINT "FK_notification_settings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "notification_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "taskId" uuid, "eventType" character varying(120) NOT NULL, "title" character varying(200) NOT NULL, "content" text NOT NULL, "payload" jsonb, "readAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7f32217be3f5f0f74b24d4f6f3a" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_user_id" ON "notification_events" ("userId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_task_id" ON "notification_events" ("taskId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_events_read_at" ON "notification_events" ("readAt")`,
    );

    await queryRunner.query(
      `ALTER TABLE "notification_events" ADD CONSTRAINT "FK_notification_events_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "notification_events" ADD CONSTRAINT "FK_notification_events_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_events" DROP CONSTRAINT "FK_notification_events_task"`,
    );

    await queryRunner.query(
      `ALTER TABLE "notification_events" DROP CONSTRAINT "FK_notification_events_user"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_events_read_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_events_task_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_events_user_id"`,
    );

    await queryRunner.query(`DROP TABLE "notification_events"`);

    await queryRunner.query(
      `ALTER TABLE "notification_settings" DROP CONSTRAINT "FK_notification_settings_user"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_notification_settings_user_id"`,
    );

    await queryRunner.query(`DROP TABLE "notification_settings"`);

    await queryRunner.query(
      `ALTER TABLE "task_artifacts" DROP CONSTRAINT "FK_task_artifacts_task_node"`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_artifacts" DROP CONSTRAINT "FK_task_artifacts_task"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_artifacts_task_node_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_task_artifacts_task_id"`);

    await queryRunner.query(`DROP TABLE "task_artifacts"`);

    await queryRunner.query(`DROP TYPE "public"."task_artifact_type_enum"`);
  }
}
