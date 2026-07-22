import {
  assessRunnerSnapshotFreshness,
  shouldAllowAutomaticRunnerSnapshotRetry,
} from './runner-snapshot-freshness';
import { computeSubRepoFingerprint } from '../git/sub-repo.types';

describe('runner snapshot freshness', () => {
  const subRepos = [
    {
      prefix: 'yanxue',
      url: 'git@example.com:backend/yanxue.git',
      branch: 'main',
    },
    {
      prefix: 'trip-shadow',
      url: 'git@example.com:frontend/trip-shadow.git',
      branch: 'main',
    },
    {
      prefix: 'trip-miniprogram',
      url: 'git@example.com:frontend/trip-miniprogram.git',
      branch: 'main',
    },
  ];
  const subRepoFingerprint = computeSubRepoFingerprint(subRepos);

  it('should mark multi-service single-root snapshot as stale', () => {
    const result = assessRunnerSnapshotFreshness({
      subRepos,
      runnerOrchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 8000,
          },
          {
            name: 'trip-shadow',
            workdir: 'trip-shadow',
            command: 'pnpm run dev',
            port: 5176,
          },
          {
            name: 'trip-miniprogram',
            workdir: 'trip-miniprogram',
            command: 'pnpm run dev:h5:local',
            port: 10086,
          },
        ],
        routes: [
          { path: '/', action: 'proxy', match: 'prefix', service: 'yanxue' },
        ],
        homepage: {
          title: 'AINative Runner',
          links: [{ label: 'yanxue', path: '/' }],
        },
        preview: { service: 'yanxue', path: '/' },
        generatedMeta: {
          subRepoFingerprint,
        },
      },
    });

    expect(result.state).toBe('stale');
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'preview-route-collapses-to-root',
        'missing-preview-route',
        'multi-service-root-collision',
      ]),
    );
  });

  it('should accept a per-service routed multi-preview snapshot', () => {
    const result = assessRunnerSnapshotFreshness({
      subRepos,
      runnerOrchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 8000,
          },
          {
            name: 'trip-shadow',
            workdir: 'trip-shadow',
            command: 'pnpm run dev',
            port: 5176,
          },
          {
            name: 'trip-miniprogram',
            workdir: 'trip-miniprogram',
            command: 'pnpm run dev:h5:local',
            port: 10086,
          },
        ],
        routes: [
          {
            path: '/yanxue/',
            action: 'proxy',
            match: 'prefix',
            service: 'yanxue',
          },
          {
            path: '/trip-shadow/',
            action: 'proxy',
            match: 'prefix',
            service: 'trip-shadow',
          },
          {
            path: '/trip-miniprogram/',
            action: 'proxy',
            match: 'prefix',
            service: 'trip-miniprogram',
          },
        ],
        homepage: {
          title: 'AINative Runner',
          links: [
            { label: 'yanxue', path: '/yanxue/' },
            { label: 'trip-shadow', path: '/trip-shadow/' },
            { label: 'trip-miniprogram', path: '/trip-miniprogram/' },
          ],
        },
        preview: { service: 'yanxue', path: '/yanxue/' },
        generatedMeta: {
          subRepoFingerprint,
          coverageStatus: 'valid',
          verificationStatus: 'passed',
        },
      },
    });

    expect(result.state).toBe('usable');
    expect(result.reasons).toEqual([]);
  });

  it('should block automatic retry inside cooldown window for the same fingerprint', () => {
    const freshness = assessRunnerSnapshotFreshness({
      subRepos,
      runnerOrchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 8000,
          },
        ],
        generatedMeta: {
          subRepoFingerprint: 'stale-fingerprint',
          coverageStatus: 'valid',
          verificationStatus: 'passed',
        },
      },
    });

    const allowed = shouldAllowAutomaticRunnerSnapshotRetry({
      freshness,
      generatorVersion: 'runner-snapshot-freshness-v1',
      refreshState: {
        fingerprint: freshness.currentSubRepoFingerprint,
        generatorVersion: 'runner-snapshot-freshness-v1',
        attemptedAt: '2026-05-28T10:00:00.000Z',
      },
      now: new Date('2026-05-28T10:03:00.000Z'),
    });

    expect(allowed).toBe(false);
  });

  it('should mark snapshot stale when generated meta is missing', () => {
    const result = assessRunnerSnapshotFreshness({
      subRepos,
      runnerOrchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 8000,
          },
        ],
      },
    });

    expect(result.state).toBe('stale');
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'missing-generated-meta',
        'missing-subrepo-fingerprint',
        'coverage-not-valid',
        'verification-not-passed',
      ]),
    );
  });

  it('should mark snapshot stale when verification did not pass', () => {
    const result = assessRunnerSnapshotFreshness({
      subRepos,
      runnerOrchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 8000,
          },
        ],
        generatedMeta: {
          subRepoFingerprint,
          coverageStatus: 'valid',
          verificationStatus: 'failed',
        },
      },
    });

    expect(result.state).toBe('stale');
    expect(result.reasons).toContain('verification-not-passed');
  });

  it('should mark snapshot stale when coverage is not valid', () => {
    const result = assessRunnerSnapshotFreshness({
      subRepos,
      runnerOrchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 8000,
          },
        ],
        generatedMeta: {
          subRepoFingerprint,
          coverageStatus: 'incomplete',
          verificationStatus: 'passed',
        },
      },
    });

    expect(result.state).toBe('stale');
    expect(result.reasons).toContain('coverage-not-valid');
  });

  it('should continue to bypass freshness gate for manually locked configs', () => {
    const result = assessRunnerSnapshotFreshness({
      subRepos,
      runnerOrchestration: {
        manuallyLocked: true,
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run .',
            port: 8000,
          },
        ],
      },
    });

    expect(result.state).toBe('usable');
    expect(result.reasons).toEqual(['manual-lock-bypass']);
  });
});
