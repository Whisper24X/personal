import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectMcpOAuthRelay1777000000000
  implements MigrationInterface
{
  name = 'AddProjectMcpOAuthRelay1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_mcp_oauth_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "provider" character varying(64) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'disconnected',
        "cliRegistry" jsonb,
        "credentialVolumeRef" character varying(160),
        "authorizedByUserId" uuid,
        "lastError" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_mcp_oauth_connections" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_project_mcp_oauth_connection_provider"
      ON "project_mcp_oauth_connections" ("projectId", "provider")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_mcp_oauth_connection_project"
      ON "project_mcp_oauth_connections" ("projectId")
    `);

    await queryRunner.query(`
      CREATE TABLE "project_mcp_oauth_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "provider" character varying(64) NOT NULL,
        "cli" character varying(24) NOT NULL,
        "authorizationUrl" text,
        "state" character varying(160),
        "containerExecRef" text NOT NULL,
        "cliLoginPort" integer,
        "status" character varying(24) NOT NULL DEFAULT 'pending',
        "errorMessage" text,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_mcp_oauth_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_mcp_oauth_sessions_project_provider"
      ON "project_mcp_oauth_sessions" ("projectId", "provider")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_mcp_oauth_sessions_expires"
      ON "project_mcp_oauth_sessions" ("expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_project_mcp_oauth_sessions_expires"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_project_mcp_oauth_sessions_project_provider"',
    );
    await queryRunner.query('DROP TABLE "project_mcp_oauth_sessions"');
    await queryRunner.query(
      'DROP INDEX "IDX_project_mcp_oauth_connection_project"',
    );
    await queryRunner.query(
      'DROP INDEX "UQ_project_mcp_oauth_connection_provider"',
    );
    await queryRunner.query('DROP TABLE "project_mcp_oauth_connections"');
  }
}
