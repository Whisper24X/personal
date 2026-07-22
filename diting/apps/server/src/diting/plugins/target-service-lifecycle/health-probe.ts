import { RunningService } from "@diting/plugin-api";
import { EnvironmentPreparationError } from "../shared";

type ProbeInput = {
  timeoutMs: number;
  intervalMs: number;
  httpGet?: (url: string) => Promise<number>;
  diagnose?: () => Promise<string | null>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

export async function waitForServiceHealth(
  service: RunningService,
  input: ProbeInput
): Promise<RunningService> {
  const now = input.now ?? (() => new Date());
  const deadline = now().getTime() + input.timeoutMs;
  const httpGet = input.httpGet ?? defaultHttpGet;
  const sleep = input.sleep ?? defaultSleep;

  while (now().getTime() <= deadline) {
    try {
      const statusCode = await httpGet(service.healthUrl);
      if (statusCode >= 200 && statusCode < 300) {
        return {
          ...service,
          status: "ready",
          readyAt: now().toISOString()
        };
      }
    } catch {
      // keep polling until timeout
    }

    if (now().getTime() > deadline) {
      break;
    }
    await sleep(input.intervalMs);
  }

  const baseDetail = `healthUrl=${service.healthUrl} timeoutMs=${input.timeoutMs}`;
  const diagnosticDetail = await input.diagnose?.();
  throw new EnvironmentPreparationError(
    "service_startup",
    `Service ${service.id} health probe timed out`,
    diagnosticDetail ? `${baseDetail} ${diagnosticDetail}` : baseDetail,
    true
  );
}

async function defaultHttpGet(url: string): Promise<number> {
  const response = await fetch(url);
  return response.status;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
