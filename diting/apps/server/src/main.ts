/**
 * 进程入口：加载多级 `.env`、读取配置并启动 Fastify（失败时格式化输出后退出）。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildServer } from "./diting/server";
import { readConfig } from "./diting/config";
import { formatStartupError, wrapBootstrapError } from "./diting/startup-errors";

type ManagedServer = {
  close: () => void | Promise<void>;
  listen: (options: { port: number; host: string }) => unknown | Promise<unknown>;
};
type SignalHandler = () => void | Promise<void>;
type SignalDisposer = () => void;

export type StartServerDependencies = {
  buildServer?: (config: ReturnType<typeof readConfig>) => Promise<ManagedServer>;
  exit?: (code?: number) => void;
  loadProjectEnv?: typeof loadProjectEnv;
  logError?: (message: string) => void;
  onSignal?: (signal: NodeJS.Signals, handler: SignalHandler) => SignalDisposer;
  readConfig?: typeof readConfig;
};

/** 极简 KEY=VALUE 解析，不解析 export、不展开变量；与 dotenv 行为接近即可。 */
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

/** cwd、上级、再上级各尝试 `.env`，便于在 monorepo 子包里启动服务。 */
function loadProjectEnv(): void {
  const cwd = process.cwd();
  loadEnvFile(resolve(cwd, ".env"));
  loadEnvFile(resolve(cwd, "..", ".env"));
  loadEnvFile(resolve(cwd, "..", "..", ".env"));
}

/** 失败时包装为可读 `Error`，写 stderr 并由进程 exit code 反映。 */
export async function startServer(deps: StartServerDependencies = {}): Promise<void> {
  const loadEnv = deps.loadProjectEnv ?? loadProjectEnv;
  const resolveConfig = deps.readConfig ?? readConfig;
  const createServer = deps.buildServer ?? buildServer;
  const exit = deps.exit ?? ((code?: number) => process.exit(code));
  const logError = deps.logError ?? ((message: string) => console.error(message));
  const onSignal = deps.onSignal ?? ((signal: NodeJS.Signals, handler: SignalHandler) => {
    process.once(signal, handler);
    return () => process.off(signal, handler);
  });
  const disposers: SignalDisposer[] = [];
  let server: ManagedServer | null = null;
  let shuttingDown = false;

  const closeAndExit = async (code: number) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
    try {
      await server?.close();
      exit(code);
    } catch (error) {
      const wrapped = wrapBootstrapError(error);
      logError(formatStartupError(wrapped));
      exit(1);
    }
  };

  try {
    loadEnv();
    const config = resolveConfig();
    server = await createServer(config);
    disposers.push(
      onSignal("SIGINT", () => closeAndExit(0)),
      onSignal("SIGTERM", () => closeAndExit(0))
    );
    await server.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
    if (server) {
      try {
        await server.close();
      } catch (closeError) {
        const wrapped = wrapBootstrapError(closeError);
        logError(formatStartupError(wrapped));
      }
    }
    const wrapped = wrapBootstrapError(error);
    logError(formatStartupError(wrapped));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void startServer();
}
