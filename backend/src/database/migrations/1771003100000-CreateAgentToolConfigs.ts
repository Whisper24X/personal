import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentToolConfigs1771003100000 implements MigrationInterface {
  name = 'CreateAgentToolConfigs1771003100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_tool_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "toolId" character varying(64) NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(255), "configJson" text NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_agent_tool_configs_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_agent_tool_config_business_line_id" ON "agent_tool_configs" ("businessLineId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_agent_tool_config_tool_id" ON "agent_tool_configs" ("toolId")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_tool_config_business_line_tool_name" ON "agent_tool_configs" ("businessLineId", "toolId", "name")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_tool_config_default_per_tool" ON "agent_tool_configs" ("businessLineId", "toolId") WHERE "isDefault" = true`,
    );

    await queryRunner.query(
      `ALTER TABLE "agent_tool_configs" ADD CONSTRAINT "FK_agent_tool_config_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_tool_configs" DROP CONSTRAINT "FK_agent_tool_config_business_line"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_agent_tool_config_default_per_tool"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_agent_tool_config_business_line_tool_name"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_tool_config_tool_id"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_tool_config_business_line_id"`,
    );

    await queryRunner.query(`DROP TABLE "agent_tool_configs"`);
  }
}
