import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1770371533805 implements MigrationInterface {
  name = 'Init1770371533805';

  private async hasIndex(
    queryRunner: QueryRunner,
    indexName: string,
  ): Promise<boolean> {
    const indexes = await queryRunner.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
      [indexName],
    );
    return indexes.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUserTable = await queryRunner.hasTable('user');
    if (!hasUserTable) {
      await queryRunner.query(
        `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying, "password" character varying, "firstName" character varying, "lastName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
      );
    }

    const hasFirstNameIndex = await this.hasIndex(
      queryRunner,
      'IDX_58e4dbff0e1a32a9bdc861bb29',
    );
    if (!hasFirstNameIndex) {
      await queryRunner.query(
        `CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `,
      );
    }

    const hasLastNameIndex = await this.hasIndex(
      queryRunner,
      'IDX_f0e1b4ecdca13b177e2e3a0613',
    );
    if (!hasLastNameIndex) {
      await queryRunner.query(
        `CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLastNameIndex = await this.hasIndex(
      queryRunner,
      'IDX_f0e1b4ecdca13b177e2e3a0613',
    );
    if (hasLastNameIndex) {
      await queryRunner.query(
        `DROP INDEX "public"."IDX_f0e1b4ecdca13b177e2e3a0613"`,
      );
    }

    const hasFirstNameIndex = await this.hasIndex(
      queryRunner,
      'IDX_58e4dbff0e1a32a9bdc861bb29',
    );
    if (hasFirstNameIndex) {
      await queryRunner.query(
        `DROP INDEX "public"."IDX_58e4dbff0e1a32a9bdc861bb29"`,
      );
    }

    const hasUserTable = await queryRunner.hasTable('user');
    if (hasUserTable) {
      await queryRunner.query(`DROP TABLE "user"`);
    }
  }
}
