import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveFilesMailSocialFromUser1760000000000
  implements MigrationInterface
{
  name = 'RemoveFilesMailSocialFromUser1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "FK_75e2be4ce11d447ef43be0e374f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "REL_75e2be4ce11d447ef43be0e374"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_9bd2fe7a8e694dedc4ec2f666f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "socialId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "photoId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "file"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "file" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "path" character varying NOT NULL, CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "provider" character varying NOT NULL DEFAULT 'email'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "socialId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "photoId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_9bd2fe7a8e694dedc4ec2f666f" ON "user" ("socialId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "REL_75e2be4ce11d447ef43be0e374" UNIQUE ("photoId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_75e2be4ce11d447ef43be0e374f" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
