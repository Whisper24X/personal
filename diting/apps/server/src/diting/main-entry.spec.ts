import { ServerConfig } from "./config";
import { startServer } from "../main";

describe("server entrypoint", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it("closes the Fastify server before exiting on SIGTERM", async () => {
    const handlers = new Map<NodeJS.Signals, () => void | Promise<void>>();
    const close = jest.fn(async () => undefined);
    const listen = jest.fn(async () => undefined);
    const exit = jest.fn();
    const config = { port: 3000 } as ServerConfig;

    await startServer({
      buildServer: async () => ({ close, listen }),
      exit,
      loadProjectEnv: () => undefined,
      logError: () => undefined,
      onSignal: (signal, handler) => {
        handlers.set(signal, handler);
        return () => handlers.delete(signal);
      },
      readConfig: () => config
    });

    await handlers.get("SIGTERM")?.();

    expect(listen).toHaveBeenCalledWith({ port: 3000, host: "0.0.0.0" });
    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("closes initialized server resources when listen fails", async () => {
    const close = jest.fn(async () => undefined);
    const listen = jest.fn(async () => {
      throw new Error("EADDRINUSE");
    });
    const logError = jest.fn();
    const config = { port: 3000 } as ServerConfig;

    await startServer({
      buildServer: async () => ({ close, listen }),
      loadProjectEnv: () => undefined,
      logError,
      onSignal: () => () => undefined,
      readConfig: () => config
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("EADDRINUSE"));
    expect(process.exitCode).toBe(1);
  });

  it("prints a clear hint when the port is already in use", async () => {
    const close = jest.fn(async () => undefined);
    const listen = jest.fn(async () => {
      const error = new Error("listen EADDRINUSE: address already in use 0.0.0.0:3000") as NodeJS.ErrnoException & {
        port?: number;
      };
      error.code = "EADDRINUSE";
      error.port = 3000;
      throw error;
    });
    const logError = jest.fn();
    const config = { port: 3000 } as ServerConfig;

    await startServer({
      buildServer: async () => ({ close, listen }),
      loadProjectEnv: () => undefined,
      logError,
      onSignal: () => () => undefined,
      readConfig: () => config
    });

    expect(logError).toHaveBeenCalledWith(expect.stringContaining("端口 3000 已被占用"));
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("BACKEND_PORT"));
    expect(process.exitCode).toBe(1);
  });
});
