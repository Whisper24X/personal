import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectRepositoryProvisioningFields1775000003000
  implements MigrationInterface
{
  name = 'AddProjectRepositoryProvisioningFields1775000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "repositoryProvisioningStatus" character varying(24) NOT NULL DEFAULT 'ready'`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "repositoryProvisioningError" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "repositoryProvisionedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN "repositoryProvisionedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN "repositoryProvisioningError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN "repositoryProvisioningStatus"`,
    );
  }
}
