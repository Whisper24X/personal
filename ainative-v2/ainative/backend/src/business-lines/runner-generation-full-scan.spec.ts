import { mkdtemp, mkdir, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { RunnerGenerationService } from './runner-generation.service';
import type { RunnerOrchestrationConfig } from '../containers/runner-orchestration.types';
import { collectRepoFacts, type RepoFacts } from './repo-facts-collector';
import { buildRunnerCandidateManifest } from './service-candidate-builder';

describe('RunnerGenerationService full scan fallback', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(tmpdir(), 'runner-fullscan-'));
  });

  function createService(options?: {
    aiConfig?: RunnerOrchestrationConfig | null;
    probeStatus?: 'passed' | 'failed' | 'skipped';
    syncSynced?: boolean;
  }): {
    service: RunnerGenerationService;
    businessLineRepository: {
      findAllWithPagination: jest.Mock;
      findById: jest.Mock;
      update: jest.Mock;
    };
    syncService: { syncToHiddenProject: jest.Mock };
    probeService: { probe: jest.Mock };
    aiGenerator: { generateFromFullScan: jest.Mock };
  } {
    const businessLineRepository = {
      findAllWithPagination: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'bl-1', configJson: {} }),
      update: jest.fn().mockResolvedValue({ id: 'bl-1', configJson: {} }),
    };
    const syncService = {
      syncToHiddenProject: jest.fn().mockResolvedValue({
        synced: options?.syncSynced ?? true,
        warnings: [],
      }),
    };
    const aiGenerator = {
      generateFromFullScan: jest.fn().mockResolvedValue({
        orchestration: options?.aiConfig ?? {
          services: [
            {
              name: 'web',
              workdir: 'web',
              command: 'npm run dev',
              port: 5173,
            },
          ],
          routes: [
            { path: '/', action: 'proxy', match: 'prefix', service: 'web' },
          ],
          preview: { service: 'web', path: '/' },
        },
        warnings: [],
        source: 'ai-full-scan',
        generatorToolId: 'codex',
        generatorConfigId: 'cfg-1',
        reasoningSummary: 'Selected Vite dev server from package.json',
      }),
    };
    const probeService = {
      probe: jest.fn().mockResolvedValue({
        status: options?.probeStatus ?? 'passed',
        mode: 'warn',
        durationMs: 123,
        ...(options?.probeStatus === 'failed'
          ? { error: 'preview unreachable', logsPreview: 'connection refused' }
          : {}),
      }),
    };

    return {
      service: new RunnerGenerationService(
        { get: jest.fn() } as any,
        businessLineRepository as any,
        { findById: jest.fn() } as any,
        aiGenerator as any,
        syncService as any,
        probeService as any,
      ),
      businessLineRepository,
      syncService,
      probeService,
      aiGenerator,
    };
  }

  it('should return ready after AI direct generation schema and validator pass', async () => {
    const repoDir = path.join(tmpRoot, 'web');
    await mkdir(repoDir, { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite --host 0.0.0.0 --port 5173' } }),
    );

    const { service, probeService } = createService();
    const result = await (service as any).tryFullScanGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['web'],
      facts: [],
      manifest: { candidates: [], warnings: [] },
      fingerprint: 'fp-1',
      warnings: [],
      isPartial: false,
      previousErrors: ['candidate probe failed'],
    });

    expect(result.status).toBe('ready');
    expect(result.orchestration.preview).toEqual({ service: 'web', path: '/' });
    expect(result.meta).toMatchObject({
      source: 'ai-full-scan',
      fullScanAttempted: true,
      verificationStatus: 'skipped',
    });
    expect(result.verificationWorkspacePath).toBeUndefined();
    expect(probeService.probe).not.toHaveBeenCalled();
  });

  it('should augment current project style services into main-like routes and env', async () => {
    await mkdir(path.join(tmpRoot, 'yanxue', 'cmd', 'yanxue'), {
      recursive: true,
    });
    await mkdir(path.join(tmpRoot, 'yanxue', 'configs'), { recursive: true });
    await writeFile(
      path.join(tmpRoot, 'yanxue', 'go.mod'),
      'module example.com/yanxue\n\nrequire github.com/go-kratos/kratos/v2 v2.8.0\n',
    );
    await writeFile(
      path.join(tmpRoot, 'yanxue', 'cmd/yanxue/main.go'),
      'package main\nfunc main() {}\n',
    );
    await writeFile(
      path.join(tmpRoot, 'yanxue', 'configs/default.yaml'),
      'server:\n  http:\n    addr: 0.0.0.0:8000\n',
    );

    await mkdir(path.join(tmpRoot, 'trip-shadow', 'src', 'routers'), {
      recursive: true,
    });
    await mkdir(path.join(tmpRoot, 'trip-shadow', 'public'), {
      recursive: true,
    });
    await writeFile(
      path.join(tmpRoot, 'trip-shadow', 'package.json'),
      JSON.stringify({
        scripts: { dev: 'rsbuild dev --env-mode development' },
        devDependencies: { rsbuild: '^0.5.0' },
      }),
    );
    await writeFile(
      path.join(tmpRoot, 'trip-shadow', '.env.development'),
      [
        'ENV="development"',
        'BASE_API_URL="https://trip-api-test.yangcong345.com/yanxue"',
        'APP_PROJECT_NAME="trip"',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpRoot, 'trip-shadow', 'rsbuild.config.ts'),
      [
        'const projectName = process.env.APP_PROJECT_NAME',
        'export default {',
        '  output: { assetPrefix: `/${projectName}` },',
        '  server: { port: 5176 },',
        '}',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpRoot, 'trip-shadow', 'src/routers/index.ts'),
      [
        "import { createRouter, createWebHistory } from 'vue-router'",
        'export default createRouter({',
        '  history: createWebHistory(process.env.APP_PROJECT_NAME),',
        '  routes: [],',
        '})',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpRoot, 'trip-shadow', 'src/service.ts'),
      'const baseURL = process.env.BASE_API_URL;\n',
    );

    await mkdir(path.join(tmpRoot, 'trip-miniprogram', 'config'), {
      recursive: true,
    });
    await writeFile(
      path.join(tmpRoot, 'trip-miniprogram', 'package.json'),
      JSON.stringify({
        scripts: {
          'dev:h5:local': 'npm run build:h5 -- --watch --mode local',
          'build:h5': 'taro build --type h5 --watch --mode local',
        },
        devDependencies: {
          '@tarojs/cli': '^4.0.0',
          '@tarojs/plugin-platform-h5': '^4.0.0',
        },
      }),
    );
    await writeFile(
      path.join(tmpRoot, 'trip-miniprogram', 'config/index.ts'),
      [
        'export default {',
        '  h5: {',
        '    ...(process.env.TARO_APP_API && {',
        '      devServer: { port: 8200, host: "0.0.0.0" },',
        '    }),',
        '  },',
        '}',
      ].join('\n'),
    );

    const facts = await Promise.all([
      collectRepoFacts(path.join(tmpRoot, 'yanxue'), 'yanxue'),
      collectRepoFacts(path.join(tmpRoot, 'trip-shadow'), 'trip-shadow'),
      collectRepoFacts(
        path.join(tmpRoot, 'trip-miniprogram'),
        'trip-miniprogram',
      ),
    ]);

    const { service } = createService({
      aiConfig: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run ./cmd/yanxue -conf ./configs',
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
        preview: { service: 'trip-shadow', path: '/' },
      },
    });

    const result = await (service as any).tryFullScanGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['yanxue', 'trip-shadow', 'trip-miniprogram'],
      facts,
      manifest: buildRunnerCandidateManifest(facts),
      fingerprint: 'fp-main-shape',
      warnings: [],
      isPartial: false,
      previousErrors: [],
    });

    expect(result.status).toBe('ready');
    expect(result.orchestration?.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'trip-shadow',
          env: expect.objectContaining({
            APP_PROJECT_NAME: 'trip-shadow',
            BASE_API_URL: '/api',
            VITE_BASE_URL: '/trip-shadow/',
            CI: 'true',
            BROWSER: 'none',
            SANDBOX: 'true',
          }),
        }),
        expect.objectContaining({
          name: 'trip-miniprogram',
          env: expect.objectContaining({
            TARO_APP_API: '/api',
            CI: 'true',
            BROWSER: 'none',
            AINATIVE_PREVIEW_HTML_INJECT: '1',
            AINATIVE_PREVIEW_HMR_PATH: '/_ainative/vite-hmr/trip-miniprogram',
            AINATIVE_PREVIEW_SERVICE_NAME: 'trip-miniprogram',
            AINATIVE_PREVIEW_SERVICE_PORT: '8200',
          }),
          port: 8200,
        }),
      ]),
    );
    expect(result.orchestration?.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
          match: 'regex',
          service: 'trip-miniprogram',
        }),
        expect.objectContaining({
          path: '/api/',
          service: 'yanxue',
          upstreamPath: '/',
          websocket: true,
        }),
        expect.objectContaining({
          path: '/trip-shadow',
          action: 'redirect',
          redirectTo: '/trip-shadow/',
        }),
        expect.objectContaining({
          path: '/trip-shadow/',
          service: 'trip-shadow',
          upstreamPath: '/',
          websocket: true,
        }),
        expect.objectContaining({
          path: '/static/',
          service: 'trip-shadow',
        }),
        expect.objectContaining({
          path: '/public/',
          service: 'trip-shadow',
        }),
        expect.objectContaining({
          path: '/rsbuild-hmr',
          service: 'trip-shadow',
          websocket: true,
        }),
        expect.objectContaining({
          path: '/trip-miniprogram',
          action: 'redirect',
          redirectTo: '/trip-miniprogram/',
        }),
        expect.objectContaining({
          path: '/_ainative/vite-hmr/trip-miniprogram',
          service: 'trip-miniprogram',
          upstreamPath: '/',
          websocket: true,
        }),
        expect.objectContaining({
          path: '/',
          service: 'trip-miniprogram',
          upstreamPath: '/',
          websocket: true,
        }),
      ]),
    );
    const staticApiRouteIndex =
      result.orchestration?.routes?.findIndex(
        (route) =>
          route.path === '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
      ) ?? -1;
    const backendApiRouteIndex =
      result.orchestration?.routes?.findIndex(
        (route) => route.path === '/api/',
      ) ?? -1;
    expect(staticApiRouteIndex).toBeGreaterThanOrEqual(0);
    expect(backendApiRouteIndex).toBeGreaterThan(staticApiRouteIndex);
    expect(result.orchestration?.homepage?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/trip-shadow/' }),
        expect.objectContaining({ path: '/trip-miniprogram/' }),
        expect.objectContaining({ path: '/api/', label: 'Backend' }),
      ]),
    );
    expect(result.orchestration?.preview).toEqual({
      service: 'trip-miniprogram',
      path: '/',
    });
  });

  it('should reject full scan output with unknown schema fields', async () => {
    const repoDir = path.join(tmpRoot, 'web');
    await mkdir(repoDir, { recursive: true });
    await writeFile(path.join(repoDir, 'package.json'), '{}');

    const { service } = createService({
      aiConfig: {
        services: [
          {
            name: 'web',
            workdir: 'web',
            command: 'npm run dev',
            port: 5173,
          },
        ],
        routes: [{ path: '/', action: 'proxy', service: 'web' }],
        preview: { service: 'web', path: '/' },
        runtime: { networkMode: 'host' },
      } as unknown as RunnerOrchestrationConfig,
    });

    const result = await (service as any).tryFullScanGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['web'],
      facts: [],
      manifest: { candidates: [], warnings: [] },
      fingerprint: 'fp-1',
      warnings: [],
      isPartial: false,
      previousErrors: [],
    });

    expect(result.status).toBe('needsManualReview');
    expect(result.error).toContain('unknown field');
    expect(result.meta).toMatchObject({
      fullScanAttempted: true,
      verificationStatus: 'skipped',
    });
  });

  it('should mark ready after async verification passes and sync succeeds', async () => {
    const orchestration: RunnerOrchestrationConfig = {
      services: [
        { name: 'web', workdir: 'web', command: 'npm run dev', port: 5173 },
      ],
      routes: [{ path: '/', action: 'proxy', service: 'web' }],
      preview: { service: 'web', path: '/' },
    };
    const { service, businessLineRepository, syncService } = createService();

    await (service as any).runVerificationJob({
      businessLineId: 'bl-1',
      fingerprint: 'fp-1',
      orchestration,
      workspacePath: tmpRoot,
      meta: {
        source: 'ai-full-scan',
        generatedAt: new Date().toISOString(),
        verificationId: 'verify-1',
        verificationStatus: 'running',
      },
    });

    expect(syncService.syncToHiddenProject).toHaveBeenCalledWith(
      'bl-1',
      orchestration,
      expect.objectContaining({ fingerprint: 'fp-1' }),
    );
    expect(businessLineRepository.update).toHaveBeenCalledWith(
      'bl-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          runnerConfigStatus: 'ready',
          runnerFingerprint: 'fp-1',
          runnerConfigCache: orchestration,
          runnerConfigCacheMeta: expect.objectContaining({
            verificationStatus: 'passed',
          }),
        }),
      }),
    );
    await expect(stat(tmpRoot)).rejects.toThrow();
  });

  it('should keep candidate generation as generated when runtime probe is skipped', async () => {
    const orchestration = {
      services: [
        { name: 'web', workdir: 'web', command: 'npm run dev', port: 5173 },
      ],
      routes: [{ path: '/', action: 'proxy', service: 'web' }],
      preview: { service: 'web', path: '/' },
      _source: 'fallback',
    } as RunnerOrchestrationConfig & { _source: 'fallback' };
    const { service } = createService({ probeStatus: 'skipped' });

    const result = await (service as any).verifyCandidateGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['web'],
      facts: [],
      manifest: { candidates: [], warnings: [] },
      fingerprint: 'fp-1',
      warnings: [],
      isPartial: false,
      finalOrchestration: orchestration,
    });

    expect(result.status).toBe('generated');
    expect(result.meta).toMatchObject({
      probeStatus: 'skipped',
      verificationStatus: 'skipped',
    });
  });

  it('should keep runtime source unsynced when async verification fails', async () => {
    const orchestration: RunnerOrchestrationConfig = {
      services: [
        { name: 'web', workdir: 'web', command: 'npm run dev', port: 5173 },
      ],
      routes: [{ path: '/', action: 'proxy', service: 'web' }],
      preview: { service: 'web', path: '/' },
    };
    const { service, businessLineRepository, syncService } = createService({
      probeStatus: 'failed',
    });

    await (service as any).runVerificationJob({
      businessLineId: 'bl-1',
      fingerprint: 'fp-1',
      orchestration,
      workspacePath: tmpRoot,
      meta: {
        source: 'ai-full-scan',
        generatedAt: new Date().toISOString(),
        verificationId: 'verify-1',
        verificationStatus: 'running',
      },
    });

    expect(syncService.syncToHiddenProject).not.toHaveBeenCalled();
    expect(businessLineRepository.update).toHaveBeenCalledWith(
      'bl-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          runnerConfigStatus: 'needsManualReview',
          runnerConfigCacheMeta: expect.objectContaining({
            verificationStatus: 'failed',
            verificationLogsPreview: 'connection refused',
          }),
        }),
      }),
    );
    await expect(stat(tmpRoot)).rejects.toThrow();
  });

  it('should keep runtime source unsynced when async verification is skipped', async () => {
    const orchestration: RunnerOrchestrationConfig = {
      services: [
        { name: 'web', workdir: 'web', command: 'npm run dev', port: 5173 },
      ],
      routes: [{ path: '/', action: 'proxy', service: 'web' }],
      preview: { service: 'web', path: '/' },
    };
    const { service, businessLineRepository, syncService } = createService({
      probeStatus: 'skipped',
    });

    await (service as any).runVerificationJob({
      businessLineId: 'bl-1',
      fingerprint: 'fp-1',
      orchestration,
      workspacePath: tmpRoot,
      meta: {
        source: 'ai-full-scan',
        generatedAt: new Date().toISOString(),
        verificationId: 'verify-1',
        verificationStatus: 'running',
      },
    });

    expect(syncService.syncToHiddenProject).not.toHaveBeenCalled();
    expect(businessLineRepository.update).toHaveBeenCalledWith(
      'bl-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          runnerConfigStatus: 'needsManualReview',
          runnerConfigError: 'AI full scan runtime verification skipped',
          runnerConfigCacheMeta: expect.objectContaining({
            verificationStatus: 'skipped',
          }),
        }),
      }),
    );
  });

  it('should recover interrupted verification records and enqueue regeneration', async () => {
    const { service, businessLineRepository } = createService();
    const enqueueSpy = jest.spyOn(service, 'enqueue').mockImplementation();
    businessLineRepository.findAllWithPagination
      .mockResolvedValueOnce([
        {
          id: 'bl-1',
          configJson: {
            subRepos: [
              {
                url: 'git@gitlab.example.com:group/web.git',
                prefix: 'web',
                branch: 'main',
              },
            ],
            runnerConfigStatus: 'verifying',
            runnerConfigCacheMeta: {
              source: 'ai-full-scan',
              generatedAt: new Date().toISOString(),
              inputFingerprint: 'fp-1',
              verificationStatus: 'running',
            },
          },
        },
      ])
      .mockResolvedValueOnce([]);
    businessLineRepository.findById.mockResolvedValue({
      id: 'bl-1',
      configJson: {
        runnerConfigStatus: 'verifying',
        runnerConfigCacheMeta: {
          source: 'ai-full-scan',
          generatedAt: new Date().toISOString(),
          inputFingerprint: 'fp-1',
          verificationStatus: 'running',
        },
      },
    });

    await (service as any).recoverInterruptedVerificationJobs();

    expect(businessLineRepository.update).toHaveBeenCalledWith(
      'bl-1',
      expect.objectContaining({
        configJson: expect.objectContaining({
          runnerConfigStatus: 'needsManualReview',
          runnerConfigError: expect.stringContaining(
            'Runner verification interrupted',
          ),
          runnerConfigCacheMeta: expect.objectContaining({
            verificationStatus: 'failed',
          }),
        }),
      }),
    );
    expect(enqueueSpy).toHaveBeenCalledWith('bl-1', { force: true });
  });

  it('should fallback when AI full scan omits a runnable backend repo with clear http evidence', async () => {
    const aiConfig: RunnerOrchestrationConfig = {
      services: [
        {
          name: 'trip-shadow',
          workdir: 'trip-shadow',
          command: 'pnpm dev -- --host 0.0.0.0 --port 5176',
          port: 5176,
        },
        {
          name: 'trip-miniprogram',
          workdir: 'trip-miniprogram',
          command: 'pnpm run dev:h5',
          port: 8200,
        },
      ],
      routes: [
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
        links: [
          { label: 'Trip Shadow', path: '/trip-shadow/' },
          { label: 'Trip Mini', path: '/trip-miniprogram/' },
        ],
      },
      preview: { service: 'trip-shadow', path: '/' },
    };
    const { service } = createService({ aiConfig });
    const facts: RepoFacts[] = [
      {
        prefix: 'yanxue',
        fileTree: [
          'README.md',
          'Makefile',
          'go.mod',
          'cmd/yanxue/main.go',
          'configs/default.yaml',
        ],
        languageHints: ['go'],
        goMod: { module: 'gitlab.yc345.tv/backend/yanxue' },
        frameworkHints: ['kratos'],
        entryFileHints: ['cmd/yanxue/main.go'],
        workdirEvidence: [
          {
            value: 'yanxue',
            source: 'repo-root',
            evidence: 'repo prefix',
            confidence: 1,
          },
        ],
        commandEvidence: [
          {
            value: 'kratos run',
            source: 'README.md',
            evidence: 'README step 6 says to run kratos run',
            confidence: 0.95,
          },
        ],
        portEvidence: [
          {
            value: 8000,
            protocol: 'http',
            source: 'configs/default.yaml',
            evidence: 'addr: 0.0.0.0:8000',
            confidence: 0.95,
          },
        ],
      },
      {
        prefix: 'trip-shadow',
        fileTree: ['package.json', 'rsbuild.config.ts'],
        languageHints: ['ts'],
        packageJson: {
          scripts: { dev: 'rsbuild dev --host 0.0.0.0 --port 5176' },
        },
        frameworkHints: ['rsbuild'],
        entryFileHints: ['src/main.ts'],
        workdirEvidence: [
          {
            value: 'trip-shadow',
            source: 'repo-root',
            evidence: 'repo prefix',
            confidence: 1,
          },
        ],
        commandEvidence: [
          {
            value: 'pnpm dev -- --host 0.0.0.0 --port 5176',
            source: 'package.json',
            evidence: 'scripts.dev',
            confidence: 0.95,
          },
        ],
        portEvidence: [
          {
            value: 5176,
            protocol: 'http',
            source: 'package.json',
            evidence: '--port 5176',
            confidence: 0.95,
          },
        ],
      },
      {
        prefix: 'trip-miniprogram',
        fileTree: ['package.json', 'config/dev.ts'],
        languageHints: ['ts'],
        packageJson: {
          scripts: { 'dev:h5': 'taro build --type h5 --watch --port 8200' },
        },
        frameworkHints: ['taro'],
        entryFileHints: ['src/app.tsx'],
        workdirEvidence: [
          {
            value: 'trip-miniprogram',
            source: 'repo-root',
            evidence: 'repo prefix',
            confidence: 1,
          },
        ],
        commandEvidence: [
          {
            value: 'pnpm run dev:h5',
            source: 'package.json',
            evidence: 'scripts.dev:h5',
            confidence: 0.95,
          },
        ],
        portEvidence: [
          {
            value: 8200,
            protocol: 'http',
            source: 'config/dev.ts',
            evidence: 'dev server port 8200',
            confidence: 0.9,
          },
        ],
      },
    ];
    const manifest = buildRunnerCandidateManifest(facts);
    const fallbackResult = {
      status: 'ready',
      orchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'kratos run',
            port: 8000,
          },
          {
            name: 'trip-shadow',
            workdir: 'trip-shadow',
            command: 'pnpm dev -- --host 0.0.0.0 --port 5176',
            port: 5176,
          },
          {
            name: 'trip-miniprogram',
            workdir: 'trip-miniprogram',
            command: 'pnpm run dev:h5',
            port: 8200,
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
          links: [
            { label: 'Yanxue API', path: '/yanxue/' },
            { label: 'Trip Shadow', path: '/trip-shadow/' },
            { label: 'Trip Mini', path: '/trip-miniprogram/' },
          ],
        },
        preview: { service: 'trip-shadow', path: '/' },
      },
      meta: {
        source: 'fallback',
        generatedAt: new Date().toISOString(),
        coverageStatus: 'valid',
        discoveredRepoPrefixes: ['yanxue', 'trip-shadow', 'trip-miniprogram'],
        selectedRepoPrefixes: ['yanxue', 'trip-shadow', 'trip-miniprogram'],
        omittedRepoPrefixes: [],
        needsConfigRepoPrefixes: [],
        omissionReasonsByRepo: {},
        autoStartLimited: false,
      },
    };
    const fallbackSpy = jest
      .spyOn(service as any, 'tryMinimalFallbackAfterFullScan')
      .mockReturnValue(fallbackResult);

    const result = await (service as any).tryFullScanGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['yanxue', 'trip-shadow', 'trip-miniprogram'],
      facts,
      manifest,
      fingerprint: 'fp-yanxue',
      warnings: [],
      isPartial: false,
      previousErrors: [],
    });

    expect(fallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('yanxue:preview-capable-not-selected'),
      }),
    );
    expect(result).toBe(fallbackResult);
  });

  it('passes previousErrors into AI full scan only when enhanced retry is enabled', async () => {
    const { service, aiGenerator } = createService();
    aiGenerator.generateFromFullScan.mockResolvedValue({
      orchestration: null,
      warnings: ['AI full scan produced no config'],
      source: 'ai-full-scan',
    });
    jest.spyOn(service as any, 'tryMinimalFallbackAfterFullScan').mockResolvedValue({
      status: 'needsManualReview',
      error: 'fallback failed',
    });

    await (service as any).tryFullScanGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['trip-shadow'],
      facts: [],
      manifest: { candidates: [], warnings: [] },
      fingerprint: 'fp-1',
      warnings: [],
      isPartial: false,
      previousErrors: ['probe failed: /trip-shadow/ returned 404'],
      enhancedRetry: true,
    });

    expect(aiGenerator.generateFromFullScan).toHaveBeenLastCalledWith('bl-1', {
      workspacePath: tmpRoot,
      repoPrefixes: ['trip-shadow'],
      previousErrors: ['probe failed: /trip-shadow/ returned 404'],
    });

    await (service as any).tryFullScanGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['trip-shadow'],
      facts: [],
      manifest: { candidates: [], warnings: [] },
      fingerprint: 'fp-2',
      warnings: [],
      isPartial: false,
      previousErrors: ['probe failed: /trip-shadow/ returned 404'],
      enhancedRetry: false,
    });

    expect(aiGenerator.generateFromFullScan).toHaveBeenLastCalledWith('bl-1', {
      workspacePath: tmpRoot,
      repoPrefixes: ['trip-shadow'],
      previousErrors: [],
    });
  });

  it('should stop for manual review when multiple rsbuild frontends compete for root static routes', async () => {
    const facts: RepoFacts[] = [
      {
        prefix: 'shadow-a',
        fileTree: ['package.json', 'rsbuild.config.ts'],
        languageHints: ['node'],
        frameworkHints: ['rsbuild'],
        entryFileHints: [],
        workdirEvidence: [
          {
            value: 'shadow-a',
            source: 'repo-root',
            evidence: 'repo prefix',
            confidence: 1,
          },
        ],
        commandEvidence: [
          {
            value: 'pnpm run dev',
            source: 'package.json:scripts.dev',
            evidence: 'rsbuild dev',
            confidence: 0.9,
          },
        ],
        portEvidence: [
          {
            value: 5176,
            protocol: 'http',
            source: 'rsbuild.config.ts',
            evidence: 'port 5176',
            confidence: 0.9,
          },
        ],
      },
      {
        prefix: 'shadow-b',
        fileTree: ['package.json', 'rsbuild.config.ts'],
        languageHints: ['node'],
        frameworkHints: ['rsbuild'],
        entryFileHints: [],
        workdirEvidence: [
          {
            value: 'shadow-b',
            source: 'repo-root',
            evidence: 'repo prefix',
            confidence: 1,
          },
        ],
        commandEvidence: [
          {
            value: 'pnpm run dev',
            source: 'package.json:scripts.dev',
            evidence: 'rsbuild dev',
            confidence: 0.9,
          },
        ],
        portEvidence: [
          {
            value: 5177,
            protocol: 'http',
            source: 'rsbuild.config.ts',
            evidence: 'port 5177',
            confidence: 0.9,
          },
        ],
      },
    ];

    await mkdir(path.join(tmpRoot, 'shadow-a'), { recursive: true });
    await mkdir(path.join(tmpRoot, 'shadow-b'), { recursive: true });
    await writeFile(
      path.join(tmpRoot, 'shadow-a', 'rsbuild.config.ts'),
      'export default {}',
    );
    await writeFile(
      path.join(tmpRoot, 'shadow-b', 'rsbuild.config.ts'),
      'export default {}',
    );

    const { service } = createService({
      aiConfig: {
        services: [
          {
            name: 'shadow-a',
            workdir: 'shadow-a',
            command: 'pnpm run dev',
            port: 5176,
          },
          {
            name: 'shadow-b',
            workdir: 'shadow-b',
            command: 'pnpm run dev',
            port: 5177,
          },
        ],
        routes: [
          {
            path: '/shadow-a/',
            action: 'proxy',
            match: 'prefix',
            service: 'shadow-a',
          },
          {
            path: '/shadow-b/',
            action: 'proxy',
            match: 'prefix',
            service: 'shadow-b',
          },
        ],
        preview: { service: 'shadow-a', path: '/' },
      },
    });

    const result = await (service as any).tryFullScanGeneration({
      businessLineId: 'bl-1',
      tmpDir: tmpRoot,
      clonedPrefixes: ['shadow-a', 'shadow-b'],
      facts,
      manifest: buildRunnerCandidateManifest(facts),
      fingerprint: 'fp-static-collision',
      warnings: [],
      isPartial: false,
      previousErrors: [],
    });

    expect(result.status).toBe('needsManualReview');
    expect(result.error).toContain(
      'Multiple frontend services require shared root asset routes',
    );
  });
});
