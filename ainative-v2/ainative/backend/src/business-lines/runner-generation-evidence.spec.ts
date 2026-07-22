import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { collectRepoFacts } from './repo-facts-collector';
import { buildDeterministicConfig } from './deterministic-runner-fallback';
import {
  validateRunnerConfig,
  validateRunnerConfigSchema,
} from './runner-config-validator';
import {
  buildDeterministicSelection,
  buildRunnerCandidateManifest,
  validateAiCandidateSelection,
} from './service-candidate-builder';
import { assembleRunnerConfigFromSelection } from './runner-config-assembler';
import { collectRunnerFullScanEvidence } from './runner-full-scan-evidence';

describe('runner evidence generation', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(tmpdir(), 'runner-evidence-'));
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('should prefer HTTP config port over first Dockerfile EXPOSE for Go services', async () => {
    const repoDir = path.join(tmpRoot, 'yanxue');
    await mkdir(path.join(repoDir, 'cmd/yanxue'), { recursive: true });
    await mkdir(path.join(repoDir, 'configs'), { recursive: true });

    await writeFile(
      path.join(repoDir, 'go.mod'),
      [
        'module example.com/yanxue',
        '',
        'require github.com/go-kratos/kratos/v2 v2.8.0',
      ].join('\n'),
    );
    await writeFile(
      path.join(repoDir, 'cmd/yanxue/main.go'),
      'package main\n\nfunc main() { _ = "-conf" }\n',
    );
    await writeFile(
      path.join(repoDir, 'configs/default.yaml'),
      [
        'server:',
        '  http:',
        '    addr: 0.0.0.0:8000',
        '  grpc:',
        '    addr: 0.0.0.0:9000',
      ].join('\n'),
    );
    await writeFile(
      path.join(repoDir, 'Dockerfile'),
      ['FROM golang:1.22', 'EXPOSE 9000', 'EXPOSE 8000'].join('\n'),
    );

    const facts = await collectRepoFacts(repoDir, 'yanxue');
    const result = buildDeterministicConfig([facts]);
    const service = result.orchestration.services[0];

    expect(
      facts.portEvidence.map((item) => ({
        value: item.value,
        protocol: item.protocol,
      })),
    ).toEqual(
      expect.arrayContaining([
        { value: 8000, protocol: 'http' },
        { value: 9000, protocol: 'grpc' },
      ]),
    );
    expect(service).toMatchObject({
      name: 'yanxue',
      workdir: 'yanxue',
      command: 'go run ./cmd/yanxue -conf ./configs',
      port: 8000,
    });
    expect(result.orchestration.preview).toEqual({
      service: 'yanxue',
      path: '/',
    });
  });

  it('should read Kratos HTTP and gRPC ports from nested cmd configs', async () => {
    const repoDir = path.join(tmpRoot, 'yanxue');
    await mkdir(path.join(repoDir, 'cmd/yanxue/configs'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'go.mod'),
      'module example.com/yanxue\n',
    );
    await writeFile(
      path.join(repoDir, 'cmd/yanxue/main.go'),
      'package main\nfunc main() { _ = "-conf" }\n',
    );
    await writeFile(
      path.join(repoDir, 'cmd/yanxue/configs/default.yaml'),
      [
        'server:',
        '  http:',
        '    addr: 0.0.0.0:8000',
        '  grpc:',
        '    addr: 0.0.0.0:9000',
      ].join('\n'),
    );

    const facts = await collectRepoFacts(repoDir, 'yanxue');
    const manifest = buildRunnerCandidateManifest([facts]);
    const selection = buildDeterministicSelection(manifest);
    const assembled = assembleRunnerConfigFromSelection(manifest, selection!);

    expect(facts.portEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 8000, protocol: 'http' }),
        expect.objectContaining({ value: 9000, protocol: 'grpc' }),
      ]),
    );
    expect(assembled?.orchestration.services[0]).toMatchObject({
      name: 'yanxue',
      port: 8000,
    });
  });

  it('should reject preview services with non-HTTP protocols', () => {
    const validation = validateRunnerConfig(
      {
        services: [
          {
            name: 'api',
            workdir: 'api',
            command: 'go run ./cmd/api',
            port: 9000,
          },
        ],
        routes: [
          { path: '/', action: 'proxy', match: 'prefix', service: 'api' },
        ],
        preview: { service: 'api', path: '/' },
      },
      { serviceProtocols: { api: 'grpc' } },
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors.join('\n')).toContain('non-HTTP protocol');
  });

  it('should reject preview services that collide with the runner listen port', () => {
    const validation = validateRunnerConfig(
      {
        services: [
          {
            name: 'api',
            workdir: 'api',
            command: 'go run ./cmd/api',
            port: 8080,
          },
        ],
      },
      { runnerListenPort: 8080 },
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors.join('\n')).toContain(
      'conflicts with runner listen port',
    );
  });

  it('should allow homepage root preview for multi-service configs', () => {
    const validation = validateRunnerConfig({
      services: [
        {
          name: 'yanxue',
          workdir: 'yanxue',
          command: 'go run ./cmd/yanxue',
          port: 8000,
        },
        {
          name: 'trip-shadow',
          workdir: 'trip-shadow',
          command: 'pnpm dev',
          port: 5176,
        },
      ],
      routes: [
        {
          path: '/yanxue/',
          action: 'proxy',
          match: 'prefix',
          service: 'yanxue',
          upstreamPath: '/',
        },
        {
          path: '/trip-shadow/',
          action: 'proxy',
          match: 'prefix',
          service: 'trip-shadow',
          upstreamPath: '/',
        },
      ],
      homepage: {
        title: 'AINative Runner',
        links: [
          { label: 'yanxue', path: '/yanxue/' },
          { label: 'trip-shadow', path: '/trip-shadow/' },
        ],
      },
      preview: { service: 'trip-shadow', path: '/' },
    });

    expect(validation.valid).toBe(true);
    expect(validation.sanitized?.preview).toEqual({
      service: 'trip-shadow',
      path: '/',
    });
  });

  it('should assemble runner config only from selected candidate ids', async () => {
    const repoDir = path.join(tmpRoot, 'web');
    await mkdir(repoDir, { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        scripts: { dev: 'vite --host 0.0.0.0 --port 5173' },
        dependencies: { vite: '^5.0.0' },
      }),
    );

    const facts = await collectRepoFacts(repoDir, 'web');
    const manifest = buildRunnerCandidateManifest([facts]);
    const selection = buildDeterministicSelection(manifest);

    expect(selection).toBeTruthy();
    const assembled = assembleRunnerConfigFromSelection(manifest, selection!);

    expect(assembled?.orchestration.services[0]).toMatchObject({
      name: 'web',
      workdir: 'web',
      command: 'npm run dev',
      port: 5173,
    });
    expect(assembled?.orchestration.preview).toEqual({
      service: 'web',
      path: '/',
    });
  });

  it('should force per-service routes for multi-service deterministic assembly', async () => {
    const repoDirA = path.join(tmpRoot, 'yanxue');
    const repoDirB = path.join(tmpRoot, 'trip-shadow');
    await mkdir(repoDirA, { recursive: true });
    await mkdir(repoDirB, { recursive: true });
    await writeFile(
      path.join(repoDirA, 'package.json'),
      JSON.stringify({
        scripts: { dev: 'vite --host 0.0.0.0 --port 8000' },
        dependencies: { vite: '^5.0.0' },
      }),
    );
    await writeFile(
      path.join(repoDirB, 'package.json'),
      JSON.stringify({
        scripts: { dev: 'vite --host 0.0.0.0 --port 5176' },
        dependencies: { vite: '^5.0.0' },
      }),
    );

    const factsA = await collectRepoFacts(repoDirA, 'yanxue');
    const factsB = await collectRepoFacts(repoDirB, 'trip-shadow');
    const manifest = buildRunnerCandidateManifest([factsA, factsB]);
    const selection = buildDeterministicSelection(manifest);
    const assembled = assembleRunnerConfigFromSelection(manifest, selection!);

    expect(assembled?.orchestration.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/yanxue/',
          service: 'yanxue',
          upstreamPath: '/',
        }),
        expect.objectContaining({
          path: '/trip-shadow/',
          service: 'trip-shadow',
          upstreamPath: '/',
        }),
      ]),
    );
    expect(assembled?.orchestration.homepage?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/yanxue/' }),
        expect.objectContaining({ path: '/trip-shadow/' }),
      ]),
    );
    expect(
      assembled?.orchestration.routes?.some((route) => route.path === '/'),
    ).toBe(false);
    expect(assembled?.orchestration.preview).toEqual({
      service: 'yanxue',
      path: '/',
    });
  });

  it('should reject AI selection that invents candidate ids', async () => {
    const repoDir = path.join(tmpRoot, 'web');
    await mkdir(repoDir, { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite --port 5173' } }),
    );

    const facts = await collectRepoFacts(repoDir, 'web');
    const manifest = buildRunnerCandidateManifest([facts]);
    const validation = validateAiCandidateSelection(
      {
        selectedServiceCandidateIds: ['made-up'],
        previewServiceCandidateId: 'made-up',
        confidence: 0.9,
      },
      manifest,
    );

    expect(validation.selection).toBeUndefined();
    expect(validation.errors.join('\n')).toContain(
      'unknown service candidate id',
    );
  });

  it('should filter candidates with retry constraints', async () => {
    const repoDir = path.join(tmpRoot, 'api');
    await mkdir(path.join(repoDir, 'cmd/api'), { recursive: true });
    await mkdir(path.join(repoDir, 'configs'), { recursive: true });
    await writeFile(path.join(repoDir, 'go.mod'), 'module example.com/api\n');
    await writeFile(
      path.join(repoDir, 'cmd/api/main.go'),
      'package main\nfunc main() {}\n',
    );
    await writeFile(
      path.join(repoDir, 'configs/default.yaml'),
      [
        'server:',
        '  http:',
        '    addr: 0.0.0.0:8080',
        '  grpc:',
        '    addr: 0.0.0.0:9000',
      ].join('\n'),
    );

    const facts = await collectRepoFacts(repoDir, 'api');
    const manifest = buildRunnerCandidateManifest([facts], {
      rejectPorts: [8080],
      rejectProtocols: ['grpc'],
    });

    expect(
      manifest.candidates.some((candidate) => candidate.port?.value === 8080),
    ).toBe(false);
    expect(
      manifest.candidates.some(
        (candidate) => candidate.port?.protocol === 'grpc',
      ),
    ).toBe(false);
  });

  it('should find deeper config evidence with targeted scan', async () => {
    const repoDir = path.join(tmpRoot, 'deep-go');
    await mkdir(path.join(repoDir, 'cmd/api'), { recursive: true });
    await mkdir(path.join(repoDir, 'configs/env/local'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'go.mod'),
      'module example.com/deep-go\n',
    );
    await writeFile(
      path.join(repoDir, 'cmd/api/main.go'),
      'package main\nfunc main() { _ = "-conf" }\n',
    );
    await writeFile(
      path.join(repoDir, 'configs/env/local/default.yaml'),
      ['server:', '  http:', '    addr: 0.0.0.0:7000'].join('\n'),
    );

    const shallowFacts = await collectRepoFacts(repoDir, 'deep-go');
    const targetedFacts = await collectRepoFacts(repoDir, 'deep-go', {
      scanMode: 'targeted',
    });

    expect(shallowFacts.portEvidence.some((item) => item.value === 7000)).toBe(
      false,
    );
    expect(targetedFacts.portEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 7000, protocol: 'http' }),
      ]),
    );
  });

  it('should extract HTTP dev port from rsbuild config source files', async () => {
    const repoDir = path.join(tmpRoot, 'trip-shadow');
    await mkdir(repoDir, { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
      JSON.stringify({
        scripts: { dev: 'rsbuild dev --env-mode development' },
        devDependencies: { rsbuild: '^0.5.0' },
      }),
    );
    await writeFile(
      path.join(repoDir, 'rsbuild.config.ts'),
      ['export default {', '  server: {', '    port: 5176,', '  },', '}'].join(
        '\n',
      ),
    );

    const facts = await collectRepoFacts(repoDir, 'trip-shadow');

    expect(facts.portEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 5176, protocol: 'http' }),
      ]),
    );
  });

  it('should add default Taro H5 dev port evidence when script has no explicit port', async () => {
    const repoDir = path.join(tmpRoot, 'trip-miniprogram');
    await mkdir(repoDir, { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
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

    const facts = await collectRepoFacts(repoDir, 'trip-miniprogram');

    expect(facts.frameworkHints).toContain('taro');
    expect(facts.portEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 10086, protocol: 'http' }),
      ]),
    );
  });

  it('should down-rank env-gated Taro h5 config ports when the selected command does not enable TARO_APP_API', async () => {
    const repoDir = path.join(tmpRoot, 'trip-miniprogram');
    await mkdir(path.join(repoDir, 'config'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
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
      path.join(repoDir, 'config/index.ts'),
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

    const facts = await collectRepoFacts(repoDir, 'trip-miniprogram');
    const defaultPort = facts.portEvidence.find((item) => item.value === 10086);
    const gatedPort = facts.portEvidence.find((item) => item.value === 8200);

    expect(defaultPort).toEqual(
      expect.objectContaining({ value: 10086, protocol: 'http' }),
    );
    expect(gatedPort).toEqual(
      expect.objectContaining({
        value: 8200,
        protocol: 'http',
      }),
    );
    expect(defaultPort?.confidence ?? 0).toBeGreaterThan(
      gatedPort?.confidence ?? 1,
    );
    expect(gatedPort?.evidence).toContain('env-gated by TARO_APP_API');
  });

  it('should ignore frontend localhost api base URLs when inferring listen ports', async () => {
    const repoDir = path.join(tmpRoot, 'trip-miniprogram');
    await mkdir(path.join(repoDir, 'src/config'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
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
      path.join(repoDir, 'src/config/env.ts'),
      'export default { local: "http://localhost:8080/app" };\n',
    );

    const facts = await collectRepoFacts(repoDir, 'trip-miniprogram');

    expect(facts.portEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 10086, protocol: 'http' }),
      ]),
    );
    expect(facts.portEvidence).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 8080 })]),
    );
  });

  it('should collect bounded full scan evidence without sensitive files', async () => {
    const repoDir = path.join(tmpRoot, 'web');
    await mkdir(path.join(repoDir, 'src'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite --port 5173' } }),
    );
    await writeFile(path.join(repoDir, '.env'), 'TOKEN=secret\n');
    await writeFile(path.join(repoDir, 'server.key'), 'PRIVATE KEY\n');
    await writeFile(path.join(repoDir, 'src/main.ts'), 'console.log("web")\n');

    const facts = await collectRepoFacts(repoDir, 'web');
    const manifest = buildRunnerCandidateManifest([facts]);
    const pack = await collectRunnerFullScanEvidence(
      tmpRoot,
      ['web'],
      [facts],
      manifest,
      ['probe failed'],
    );

    expect(pack.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['package.json', 'src/main.ts']),
    );
    expect(pack.files.map((file) => file.path)).not.toEqual(
      expect.arrayContaining(['.env', 'server.key']),
    );
    expect(JSON.stringify(pack)).not.toContain('TOKEN=secret');
  });

  it('should reject full scan JSON with unknown top-level fields', () => {
    const schema = validateRunnerConfigSchema({
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
    });

    expect(schema.valid).toBe(false);
    expect(schema.errors.join('\n')).toContain("root: unknown field 'runtime'");
  });

  it('should reject multi-service preview layouts that collapse to root', () => {
    const validation = validateRunnerConfig({
      services: [
        {
          name: 'yanxue',
          workdir: 'yanxue',
          command: 'pnpm run dev',
          port: 8000,
        },
        {
          name: 'trip-shadow',
          workdir: 'trip-shadow',
          command: 'pnpm run dev',
          port: 5176,
        },
      ],
      routes: [{ path: '/', action: 'proxy', service: 'yanxue' }],
      homepage: {
        title: 'AINative Runner',
        links: [{ label: 'yanxue', path: '/' }],
      },
      preview: { service: 'yanxue', path: '/' },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.join('\n')).toContain(
      "multi-service preview service 'yanxue' must not rely on '/' as its only proxy route",
    );
    expect(validation.errors.join('\n')).toContain(
      "multi-service preview service 'trip-shadow' must have a dedicated proxy route",
    );
    expect(validation.errors.join('\n')).toContain(
      "multi-service homepage links must not point to '/'",
    );
  });
});
