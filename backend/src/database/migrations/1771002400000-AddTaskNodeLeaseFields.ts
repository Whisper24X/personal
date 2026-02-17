import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskNodeLeaseFields1771002400000
  implements MigrationInterface
{
  name = 'AddTaskNodeLeaseFields1771002400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD "workerId" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD "leaseUntil" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD "heartbeatAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_status_lease_until" ON "task_nodes" ("status", "leaseUntil") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_nodes_task_status_order" ON "task_nodes" ("taskId", "status", "nodeOrder") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_nodes_task_status_order"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_nodes_status_lease_until"`,
    );
    await queryRunner.query(`ALTER TABLE "task_nodes" DROP COLUMN "heartbeatAt"`);
    await queryRunner.query(`ALTER TABLE "task_nodes" DROP COLUMN "leaseUntil"`);
    await queryRunner.query(`ALTER TABLE "task_nodes" DROP COLUMN "workerId"`);
  }
}
