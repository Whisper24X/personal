import { ServiceStartupConfig, parseServiceStartupConfigYaml } from "./service-startup";

describe("parseServiceStartupConfigYaml", () => {
  it("parses schema version 1 services yaml", () => {
    const parsed = parseServiceStartupConfigYaml(`
schemaVersion: 1
defaults:
  startupTimeoutMs: 120000
  stopTimeoutMs: 15000
  env:
    NODE_ENV: test
services:
  - id: backend
    repoKey: Repo1
    cwd: apps/server
    command: ["npm", "run", "start:dev"]
    healthUrl: http://127.0.0.1:3000/api/health
    healthIntervalMs: 2000
    port: 3000
  - id: frontend
    cwd: apps/web
    command: ["npm", "run", "dev"]
    healthUrl: http://127.0.0.1:5173
    dependsOn: [backend]
`);

    expect(parsed).toEqual({
      schemaVersion: 1,
      defaults: {
        startupTimeoutMs: 120000,
        stopTimeoutMs: 15000,
        env: {
          NODE_ENV: "test"
        }
      },
      services: [
        {
          id: "backend",
          repoKey: "Repo1",
          cwd: "apps/server",
          command: ["npm", "run", "start:dev"],
          healthUrl: "http://127.0.0.1:3000/api/health",
          healthIntervalMs: 2000,
          port: 3000
        },
        {
          id: "frontend",
          cwd: "apps/web",
          command: ["npm", "run", "dev"],
          healthUrl: "http://127.0.0.1:5173",
          dependsOn: ["backend"]
        }
      ]
    });
  });

  it("throws when schemaVersion is not 1", () => {
    expect(() =>
      parseServiceStartupConfigYaml(`
schemaVersion: 2
services:
  - id: backend
    cwd: apps/server
    command: ["npm", "run", "start:dev"]
    healthUrl: http://127.0.0.1:3000/api/health
`)
    ).toThrow("service startup schemaVersion must be 1");
  });

  it("throws when required service fields are missing", () => {
    expect(() =>
      parseServiceStartupConfigYaml(`
schemaVersion: 1
services:
  - id: backend
    cwd: apps/server
    command: ["npm", "run", "start:dev"]
`)
    ).toThrow("services[0].healthUrl is required");
  });

  it("accepts inline servicesYaml in service startup task config", () => {
    const config: ServiceStartupConfig = {
      configPath: ".diting/generated/services.yaml",
      servicesYaml: `
schemaVersion: 1
services:
  - id: backend
    cwd: apps/server
    command: ["npm", "run", "start:dev"]
    healthUrl: http://127.0.0.1:3000/api/health
`
    };

    expect(config.servicesYaml).toContain("schemaVersion: 1");
  });
});
