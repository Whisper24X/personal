import { execFileSync } from 'child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'path';
import { pathToFileURL } from 'url';

describe('runner render config', () => {
  function renderSamples(): {
    defaultPath: string;
    defaultEnv: string;
    customEnv: string;
    wrapperWithPort: string;
    wrapperWithoutPort: string;
    renderedNginxWithInject: string;
  } {
    const scriptPath = path.resolve(
      __dirname,
      '../../../runner/render-runner-config.mjs',
    );
    const code = `
      const mod = await import(${JSON.stringify(pathToFileURL(scriptPath).href)});
      process.stdout.write(JSON.stringify({
        defaultPath: mod.DEFAULT_SERVICE_PATH,
        defaultEnv: mod.renderEnvironment(),
        customEnv: mod.renderEnvironment({ NODE_ENV: 'development' }),
        wrapperWithPort: mod.renderServiceWrapper({
          name: 'yanxue',
          workdir: 'yanxue',
          command: 'pnpm dev',
          port: 8000,
          installCommand: 'pnpm install --frozen-lockfile'
        }),
        wrapperWithoutPort: mod.renderServiceWrapper({
          name: 'worker',
          workdir: 'worker',
          command: 'node worker.js'
        }),
        renderedNginxWithInject: mod.renderNginxConfig(
          {
            services: [
              {
                name: 'trip-miniprogram',
                workdir: 'trip-miniprogram',
                command: 'npm run dev:h5:local',
                port: 8200,
                env: {
                  AINATIVE_PREVIEW_HTML_INJECT: '1',
                  AINATIVE_PREVIEW_HMR_PATH: '/_ainative/vite-hmr/trip-miniprogram',
                  AINATIVE_PREVIEW_SERVICE_NAME: 'trip-miniprogram',
                  AINATIVE_PREVIEW_SERVICE_PORT: '8200'
                }
              },
              {
                name: 'backend',
                workdir: 'backend',
                command: 'pnpm dev',
                port: 8000
              }
            ],
            routes: [
              {
                path: '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
                action: 'proxy',
                match: 'regex',
                service: 'trip-miniprogram',
                upstreamPath: '/',
              },
              {
                path: '/trip-miniprogram/',
                action: 'proxy',
                match: 'prefix',
                service: 'trip-miniprogram',
                upstreamPath: '/',
                websocket: true
              },
              {
                path: '/_ainative/vite-hmr/trip-miniprogram',
                action: 'proxy',
                match: 'prefix',
                service: 'trip-miniprogram',
                upstreamPath: '/',
                websocket: true
              },
              {
                path: '/api/',
                action: 'proxy',
                match: 'prefix',
                service: 'backend',
                upstreamPath: '/',
                websocket: true
              }
            ]
          },
          new Map([
            ['trip-miniprogram', {
              name: 'trip-miniprogram',
              workdir: 'trip-miniprogram',
              command: 'npm run dev:h5:local',
              port: 8200,
              env: {
                AINATIVE_PREVIEW_HTML_INJECT: '1',
                AINATIVE_PREVIEW_HMR_PATH: '/_ainative/vite-hmr/trip-miniprogram',
                AINATIVE_PREVIEW_SERVICE_NAME: 'trip-miniprogram',
                AINATIVE_PREVIEW_SERVICE_PORT: '8200'
              }
            }],
            ['backend', {
              name: 'backend',
              workdir: 'backend',
              command: 'pnpm dev',
              port: 8000,
              env: {}
            }]
          ]),
          'https://app.example.com/preview-iframe-bridge.js'
        )
      }));
    `;
    return JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', code], {
        encoding: 'utf-8',
      }),
    ) as {
      defaultPath: string;
      defaultEnv: string;
      customEnv: string;
      wrapperWithPort: string;
      wrapperWithoutPort: string;
      renderedNginxWithInject: string;
    };
  }

  it('should include Go and runner CLI paths in default service PATH', () => {
    const rendered = renderSamples().defaultEnv;

    expect(rendered).toContain('PATH="');
    expect(rendered).toContain('/usr/local/go/bin');
    expect(rendered).toContain('/go/bin');
    expect(rendered).toContain('/root/.local/bin');
    expect(rendered).toContain('/root/.opencode/bin');
  });

  it('should preserve default PATH when service env omits PATH', () => {
    const { customEnv, defaultPath } = renderSamples();

    expect(customEnv).toContain(`PATH="${defaultPath}"`);
    expect(customEnv).toContain('NODE_ENV="development"');
  });

  it('should render service wrapper with runtime status reporting and readiness timeout', () => {
    const { wrapperWithPort } = renderSamples();

    expect(wrapperWithPort).toContain('STATUS_FILE="${STATUS_DIR}"/yanxue.json');
    expect(wrapperWithPort).toContain('write_status installing "Installing dependencies"');
    expect(wrapperWithPort).toContain('write_status starting "Launching service command"');
    expect(wrapperWithPort).toContain('write_status listening "Service listening on port ${SERVICE_PORT}"');
    expect(wrapperWithPort).toContain('/bin/bash -c "$raw_command"');
    expect(wrapperWithPort).toContain("/bin/bash -c 'pnpm dev' &");
    expect(wrapperWithPort).not.toContain('/bin/bash -lc "$raw_command"');
    expect(wrapperWithPort).not.toContain("/bin/bash -lc 'pnpm dev' &");
    expect(wrapperWithPort).toContain(
      'write_status failed "Expected port ${SERVICE_PORT} did not start listening within ${READY_TIMEOUT_SECONDS}s"',
    );
  });

  it('should render portless service wrapper as listening once process is running', () => {
    const { wrapperWithoutPort } = renderSamples();

    expect(wrapperWithoutPort).toContain('if [ -z "$SERVICE_PORT" ]; then');
    expect(wrapperWithoutPort).toContain('write_status listening "Service process is running"');
  });

  it('should write failed status when a service never starts listening', async () => {
    const scriptPath = path.resolve(
      __dirname,
      '../../../runner/render-runner-config.mjs',
    );
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-wrapper-'));
    const statusDir = path.join(tempRoot, 'status');
    const workspaceDir = path.join(tempRoot, 'workspace');
    const serviceDir = path.join(workspaceDir, 'svc');
    const wrapperPath = path.join(tempRoot, 'wrapper.sh');
    await fs.mkdir(serviceDir, { recursive: true });

    const renderCode = `
      const mod = await import(${JSON.stringify(pathToFileURL(scriptPath).href)});
      process.stdout.write(
        mod.renderServiceWrapper({
          name: 'svc',
          workdir: 'svc',
          command: 'sleep 3',
          port: 65530
        })
      );
    `;
    const wrapper = execFileSync(process.execPath, ['--input-type=module', '-e', renderCode], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        AINATIVE_RUNNER_WORKSPACE: workspaceDir,
      },
    });
    await fs.writeFile(wrapperPath, wrapper, { encoding: 'utf-8', mode: 0o755 });

    execFileSync('/bin/bash', [wrapperPath], {
      cwd: serviceDir,
      env: {
        ...process.env,
        AINATIVE_RUNNER_WORKSPACE: workspaceDir,
        AINATIVE_RUNNER_STATUS_DIR: statusDir,
        AINATIVE_RUNNER_SERVICE_READY_TIMEOUT_SECONDS: '1',
        AINATIVE_RUNNER_STATUS_CHECK_INTERVAL_SECONDS: '1',
      },
      stdio: 'ignore',
    });

    const statusPayload = JSON.parse(
      await fs.readFile(path.join(statusDir, 'svc.json'), 'utf-8'),
    ) as {
      phase?: string;
      message?: string | null;
    };

    expect(statusPayload.phase).toBe('failed');
    expect(statusPayload.message).toContain('before port 65530 became ready');
  });

  it('should inject bootstrap html for preview services even when route is websocket-enabled', () => {
    const { renderedNginxWithInject } = renderSamples();

    expect(renderedNginxWithInject).toContain('location /trip-miniprogram/ {');
    expect(renderedNginxWithInject).toContain(
      'location ~ ^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$ {',
    );
    expect(renderedNginxWithInject).toContain(
      "location ~ ^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$ {\n            proxy_pass http://127.0.0.1:8200;",
    );
    expect(renderedNginxWithInject).toContain(
      "location /trip-miniprogram/ {\n            proxy_pass http://127.0.0.1:8200/;",
    );
    expect(renderedNginxWithInject).toContain('proxy_set_header Upgrade $http_upgrade;');
    expect(renderedNginxWithInject).toContain('window.atob');
    expect(renderedNginxWithInject).toContain('(0,Function)(window.atob(');
    expect(renderedNginxWithInject).toContain('/_ainative/vite-hmr/trip-miniprogram');
    expect(renderedNginxWithInject).toContain("location /_ainative/vite-hmr/trip-miniprogram {");
    expect(renderedNginxWithInject).not.toContain(
      "location /_ainative/vite-hmr/trip-miniprogram {\n            proxy_pass http://127.0.0.1:8200/;\n            proxy_http_version 1.1;\n            proxy_set_header Host $host;\n            proxy_set_header X-Real-IP $remote_addr;\n            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n            proxy_set_header X-Forwarded-Proto $scheme;\n            proxy_set_header Upgrade $http_upgrade;\n            proxy_set_header Connection $connection_upgrade;\n            proxy_set_header Accept-Encoding \"\";",
    );
    expect(renderedNginxWithInject).not.toContain('window.__AINATIVE_PREVIEW_CONTEXT__=ctx;');
    expect(renderedNginxWithInject).not.toContain('/^wss?:$/.test(parsed.protocol)');
  });
});
