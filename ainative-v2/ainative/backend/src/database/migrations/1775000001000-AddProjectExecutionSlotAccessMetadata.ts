import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectExecutionSlotAccessMetadata1775000001000
  implements MigrationInterface
{
  name = 'AddProjectExecutionSlotAccessMetadata1775000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_execution_slots" ADD "accessMetadata" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_execution_slots" DROP COLUMN "accessMetadata"`,
    );
  }
}
