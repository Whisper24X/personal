import { RunningService } from "@diting/plugin-api";
import { EnvironmentPreparationError } from "../shared";
import { waitForServiceHealth } from "./health-probe";

describe("waitForServiceHealth", () => {
  it("marks service ready when probe returns HTTP 200", async () => {
    const service = createRunningService();

    const ready = await waitForServiceHealth(service, {
      timeoutMs: 3_000,
      intervalMs: 200,
      httpGet: async () => 200,
      sleep: async () => undefined,
      now: () => new Date("2026-06-22T02:03:04.000Z")
    });

    expect(ready.status).toBe("ready");
    expect(ready.readyAt).toBe("2026-06-22T02:03:04.000Z");
  });

  it("retries until health endpoint is ready", async () => {
    const service = createRunningService();
    const statuses = [503, 503, 200];
    const sleeps: number[] = [];

    const ready = await waitForServiceHealth(service, {
      timeoutMs: 5_000,
      intervalMs: 300,
      httpGet: async () => statuses.shift() ?? 500,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => new Date("2026-06-22T02:03:05.000Z")
    });

    expect(ready.status).toBe("ready");
    expect(sleeps).toEqual([300, 300]);
  });

  it("throws service_startup error on timeout", async () => {
    const service = createRunningService();

    await expect(
      waitForServiceHealth(service, {
        timeoutMs: 500,
        intervalMs: 200,
        httpGet: async () => 503,
        sleep: async () => undefined,
        now: (() => {
          const values = [
            new Date("2026-06-22T02:03:00.000Z"),
            new Date("2026-06-22T02:03:00.300Z"),
            new Date("2026-06-22T02:03:00.600Z")
          ];
          return () => values.shift() ?? new Date("2026-06-22T02:03:00.600Z");
        })()
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<EnvironmentPreparationError>>({
        name: "EnvironmentPreparationError",
        stage: "service_startup",
        retryable: true
      })
    );
  });
});

function createRunningService(): RunningService {
  return {
    id: "backend",
    pid: 1234,
    cwd: "/tmp/repo/apps/server",
    command: ["npm", "run", "start:dev"],
    healthUrl: "http://127.0.0.1:3000/health",
    startedAt: "2026-06-22T02:00:00.000Z",
    readyAt: null,
    status: "starting"
  };
}
