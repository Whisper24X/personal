import { parseEphemeralMcpConfig } from './parse-ephemeral-mcp-config';

describe('parseEphemeralMcpConfig', () => {
  it('should return null when containerRuntime missing', () => {
    expect(parseEphemeralMcpConfig({ agentRunner: {} })).toBeNull();
  });

  it('should parse templates and limits', () => {
    const cfg = parseEphemeralMcpConfig({
      containerRuntime: {
        ephemeralMcp: {
          maxConcurrentPerRunner: 2,
          injectAuditEnv: false,
          templates: [
            {
              id: 'demo',
              enabled: true,
              listenPort: 5980,
              command: 'npx',
              args: ['-y', '@foo/bar'],
              healthPath: '/health',
              urlPath: '/sse',
              envVarName: 'MY_MCP_URL',
            },
          ],
        },
      },
    });
    expect(cfg).toMatchObject({
      maxConcurrentPerRunner: 2,
      injectAuditEnv: false,
      templates: [
        expect.objectContaining({
          id: 'demo',
          listenPort: 5980,
          command: 'npx',
          args: ['-y', '@foo/bar'],
          healthPath: '/health',
          urlPath: '/sse',
          envVarName: 'MY_MCP_URL',
        }),
      ],
    });
  });

  it('should drop invalid template rows', () => {
    const cfg = parseEphemeralMcpConfig({
      containerRuntime: {
        ephemeralMcp: {
          templates: [
            { id: 'bad', listenPort: NaN, command: 'npx' },
            { id: 'ok', listenPort: 9000, command: 'npx', args: ['-v'] },
          ],
        },
      },
    });
    expect(cfg?.templates).toHaveLength(1);
    expect(cfg?.templates?.[0].id).toBe('ok');
  });
});
