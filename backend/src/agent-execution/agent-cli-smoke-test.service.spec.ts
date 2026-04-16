import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import {
  AgentCliSmokeTestService,
  E2E_PROBE_USER_MESSAGE,
} from './agent-cli-smoke-test.service';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { LocalProcessLauncherService } from './local-process-launcher.service';

type MockChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin?: { write: jest.Mock; end: jest.Mock };
  kill: jest.Mock;
};

describe('AgentCliSmokeTestService', () => {
  const registry = new AgentCliAdapterRegistry();

  const createConfigService = (
    extra: Record<string, string | undefined> = {},
  ): ConfigService =>
    ({
      get: jest.fn((key: string) => extra[key]),
    }) as unknown as ConfigService;

  const createMockChild = (): MockChild => {
    const child = new EventEmitter() as MockChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: jest.fn(), end: jest.fn() };
    child.kill = jest.fn();
    return child;
  };

  const createService = (
    child: MockChild,
    configExtra: Record<string, string | undefined> = {},
  ) => {
    const launcher = {
      spawn: jest.fn().mockReturnValue(child),
    } as unknown as LocalProcessLauncherService;

    return {
      service: new AgentCliSmokeTestService(
        createConfigService({
          AINATIVE_AGENT_CLI_SMOKE_TEST_TIMEOUT_MS: '5000',
          ...configExtra,
        }),
        registry,
        launcher,
      ),
      launcher,
    };
  };

  it('should return ok when the child exits 0', async () => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stdout.emit('data', '{"type":"assistant"}\n');
      child.emit('close', 0);
    });

    const { service } = createService(child);

    const result = await service.runSmokeTest({
      toolId: 'codex',
      configJson: {},
    });

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.errorCode).toBeUndefined();
    expect(child.stdin?.write).toHaveBeenCalledWith(E2E_PROBE_USER_MESSAGE);
    expect(child.stdin?.end).toHaveBeenCalled();
  });

  it('should write probe to stdin for claude and not for opencode', async () => {
    const childCodex = createMockChild();
    queueMicrotask(() => {
      childCodex.emit('close', 0);
    });
    const { service: svcClaude } = createService(childCodex);
    await svcClaude.runSmokeTest({ toolId: 'claude-code', configJson: {} });
    expect(childCodex.stdin?.write).toHaveBeenCalledWith(
      E2E_PROBE_USER_MESSAGE,
    );

    const childOpen = createMockChild();
    queueMicrotask(() => {
      childOpen.emit('close', 0);
    });
    const { service: svcOpen } = createService(childOpen);
    await svcOpen.runSmokeTest({ toolId: 'opencode', configJson: {} });
    expect(childOpen.stdin?.write).not.toHaveBeenCalled();
  });

  it('should append probe as last arg for cursor and skip stdin', async () => {
    const child = createMockChild();
    const { service, launcher } = createService(child);
    queueMicrotask(() => {
      child.emit('close', 0);
    });

    await service.runSmokeTest({
      toolId: 'cursor-agent',
      configJson: {},
    });

    const spawnCall = (launcher as { spawn: jest.Mock }).spawn.mock.calls[0][0];
    expect(spawnCall.args[spawnCall.args.length - 1]).toBe(
      E2E_PROBE_USER_MESSAGE,
    );
    expect(child.stdin?.write).not.toHaveBeenCalled();
  });

  it('should return NON_ZERO when exit code is not 0', async () => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stderr.emit('data', 'bad\n');
      child.emit('close', 2);
    });

    const { service } = createService(child);

    const result = await service.runSmokeTest({
      toolId: 'codex',
      configJson: {},
    });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.errorCode).toBe('NON_ZERO');
    expect(result.stderrPreview).toContain('bad');
  });

  it('should return AUTH_ERROR when exit 0 but output suggests auth failure', async () => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stderr.emit('data', 'Error: Unauthorized\n');
      child.emit('close', 0);
    });

    const { service } = createService(child);

    const result = await service.runSmokeTest({
      toolId: 'codex',
      configJson: {},
    });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.errorCode).toBe('AUTH_ERROR');
  });

  it('should return ENOENT when spawn fails with ENOENT', async () => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.emit(
        'error',
        Object.assign(new Error('spawn xxx ENOENT'), { code: 'ENOENT' }),
      );
    });

    const { service } = createService(child);

    const result = await service.runSmokeTest({
      toolId: 'codex',
      configJson: {},
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ENOENT');
  });

  it('should throw BadRequestException for unknown tool id', async () => {
    const child = createMockChild();
    const { service } = createService(child);

    await expect(
      service.runSmokeTest({
        toolId: 'not-a-real-cli',
        configJson: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should resolve TIMEOUT when the process does not exit in time', async () => {
    jest.useFakeTimers();

    const child = createMockChild();
    const { service } = createService(child);

    const pending = service.runSmokeTest({
      toolId: 'codex',
      configJson: {},
    });

    await jest.advanceTimersByTimeAsync(5_000);

    const result = await pending;

    jest.useRealTimers();

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('TIMEOUT');
    expect(child.kill).toHaveBeenCalled();
  });
});
