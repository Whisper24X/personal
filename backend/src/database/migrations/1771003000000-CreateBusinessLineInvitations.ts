import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessLineInvitations1771003000000
  implements MigrationInterface
{
  name = 'CreateBusinessLineInvitations1771003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "business_line_invitations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "businessLineId" uuid NOT NULL, "token" character varying(128) NOT NULL, "role" "public"."business_line_member_role_enum" NOT NULL, "projectRoles" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdBy" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_business_line_invitations_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_invitation_business_line_id" ON "business_line_invitations" ("businessLineId")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_invitation_token" ON "business_line_invitations" ("token")`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_business_line_invitation_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_business_line_invitation_created_by" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP CONSTRAINT "FK_business_line_invitation_created_by"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP CONSTRAINT "FK_business_line_invitation_business_line"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_business_line_invitation_token"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_invitation_business_line_id"`,
    );

    await queryRunner.query(`DROP TABLE "business_line_invitations"`);
  }
}
