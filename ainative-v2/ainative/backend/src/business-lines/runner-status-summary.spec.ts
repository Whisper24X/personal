import { buildRunnerStatusSummary } from './runner-status-summary';

describe('buildRunnerStatusSummary', () => {
  it('should expose verification and full scan diagnostics', () => {
    const summary = buildRunnerStatusSummary({
      runnerConfigStatus: 'needsManualReview',
      runnerConfigError: 'preview unreachable',
      runnerConfigUpdatedAt: '2026-05-25T11:00:00.000Z',
      runnerConfigCacheMeta: {
        source: 'ai-full-scan',
        generatedAt: '2026-05-25T10:59:00.000Z',
        verificationStatus: 'failed',
        verificationDurationMs: 1200,
        verificationError: 'connection refused',
        verificationLogsPreview: 'app crashed',
        probeStatus: 'failed',
        probeMode: 'warn',
        routeProbeResults: [
          {
            path: '/trip-shadow/',
            service: 'trip-shadow',
            port: 5173,
            status: 'failed',
            statusCode: 502,
            error: 'HTTP 502',
          },
        ],
        probeRepaired: true,
        probeRepairSummary: 'trip-shadow: 5173 -> 5176',
        fullScanAttempted: true,
        fullScanError: 'probe failed',
        fullScanEvidenceBytes: 1024,
        analysisWarnings: ['first', 'latest'],
      },
    });

    expect(summary).toEqual(
      expect.objectContaining({
        status: 'needsManualReview',
        statusLabel: 'needs manual review',
        source: 'ai-full-scan',
        verificationStatus: 'failed',
        verificationError: 'connection refused',
        verificationLogsPreview: 'app crashed',
        fullScanAttempted: true,
        routeProbeResults: [
          expect.objectContaining({
            path: '/trip-shadow/',
            service: 'trip-shadow',
            status: 'failed',
          }),
        ],
        probeRepaired: true,
        probeRepairSummary: 'trip-shadow: 5173 -> 5176',
        warningCount: 2,
        latestWarning: 'latest',
      }),
    );
  });

  it('should label ready as verified ready', () => {
    expect(
      buildRunnerStatusSummary({
        runnerConfigStatus: 'ready',
        runnerConfigCacheMeta: {
          source: 'fallback',
          generatedAt: '2026-05-25T10:59:00.000Z',
          verificationStatus: 'passed',
          coverageStatus: 'valid',
        },
      }),
    ).toMatchObject({
      status: 'ready',
      statusLabel: 'verified ready',
      verificationStatus: 'passed',
      verifiedReady: true,
    });
  });

  it('should not label ready as verified without passed verification', () => {
    expect(
      buildRunnerStatusSummary({
        runnerConfigStatus: 'ready',
        runnerConfigCacheMeta: {
          source: 'fallback',
          generatedAt: '2026-05-25T10:59:00.000Z',
          verificationStatus: 'skipped',
        },
      }),
    ).toMatchObject({
      status: 'ready',
      statusLabel: 'ready, unverified - reset config required',
      verificationStatus: 'skipped',
      verifiedReady: false,
    });
  });

  it('should not treat legacy ready without verification metadata as verified', () => {
    expect(
      buildRunnerStatusSummary({
        runnerConfigStatus: 'ready',
        runnerConfigCacheMeta: {
          source: 'fallback',
          generatedAt: '2026-05-25T10:59:00.000Z',
        },
      }),
    ).toMatchObject({
      status: 'ready',
      statusLabel: 'ready, unverified - reset config required',
      verifiedReady: false,
    });
  });
});
