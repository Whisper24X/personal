import { createSlowApiDiagnostics } from './slow-api-diagnostics';

describe('SlowApiDiagnosticsSession', () => {
  const originalEnabled = process.env.SLOW_API_DIAGNOSTICS_ENABLED;

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.SLOW_API_DIAGNOSTICS_ENABLED;
    } else {
      process.env.SLOW_API_DIAGNOSTICS_ENABLED = originalEnabled;
    }
    jest.restoreAllMocks();
  });

  it('should include cpu and event loop runtime metrics for slow requests', async () => {
    process.env.SLOW_API_DIAGNOSTICS_ENABLED = 'true';
    const logger = {
      warn: jest.fn(),
    };
    const diagnostics = createSlowApiDiagnostics(
      'slow.scope',
      {
        requestId: 'req-1',
      },
      logger,
    );

    await new Promise((resolve) => setTimeout(resolve, 520));
    diagnostics.flush();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logger.warn.mock.calls[0][0]) as Record<
      string,
      number | string
    >;

    expect(payload.scope).toBe('slow.scope');
    expect(payload.requestId).toBe('req-1');
    expect(payload.totalMs).toBeGreaterThanOrEqual(500);
    expect(payload.cpuUserMs).toBeGreaterThanOrEqual(0);
    expect(payload.cpuSystemMs).toBeGreaterThanOrEqual(0);
    expect(payload.cpuTotalMs).toBeGreaterThanOrEqual(0);
    expect(payload.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(payload.eventLoopActiveMs).toBeGreaterThanOrEqual(0);
    expect(payload.eventLoopIdleMs).toBeGreaterThanOrEqual(0);
    expect(payload.eventLoopUtilization).toBeGreaterThanOrEqual(0);
    expect(payload.eventLoopDelayResolutionMs).toBe(20);
    expect(payload.eventLoopDelayMaxMs).toBeGreaterThanOrEqual(0);
    expect(payload.eventLoopDelayP99Ms).toBeGreaterThanOrEqual(0);
    expect(payload.eventLoopDelayExceeded).toBeGreaterThanOrEqual(0);
  });
});
