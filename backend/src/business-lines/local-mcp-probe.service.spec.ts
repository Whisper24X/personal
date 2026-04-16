import { Test } from '@nestjs/testing';
import { AgentCliSmokeTestService } from '../agent-execution/agent-cli-smoke-test.service';
import { AgentCliAdapterRegistry } from '../agent-execution/agent-cli/agent-cli-adapter.registry';
import { LocalMcpProbeService } from './local-mcp-probe.service';

jest.mock('@modelcontextprotocol/sdk/client', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      listTools: jest
        .fn()
        .mockResolvedValue({ tools: [{ name: 'x' }, { name: 'y' }] }),
    })),
  };
});

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn(),
}));

describe('LocalMcpProbeService', () => {
  let service: LocalMcpProbeService;

  const agentCliSmokeTestService = {
    buildProbeEnvironmentForAgentToolConfig: jest.fn().mockReturnValue({
      PATH: '/usr/bin',
    }),
    resolveLocalMcpProbeTimeoutMs: jest.fn().mockReturnValue(5_000),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LocalMcpProbeService,
        AgentCliAdapterRegistry,
        {
          provide: AgentCliSmokeTestService,
          useValue: agentCliSmokeTestService,
        },
      ],
    }).compile();

    service = moduleRef.get(LocalMcpProbeService);
  });

  it('should probe stdio MCP and return tools count', async () => {
    const result = await service.probeWithResolvedLocal({
      agentToolConfig: {
        toolId: 'claude-code',
        configJson: JSON.stringify({
          mcp_config: ['/data/bl/mcp/mcp.json'],
        }),
      },
      local: {
        name: 'demo',
        sourcePath: '/data/bl/mcp/mcp.json',
        config: {
          command: 'node',
          args: ['-e', 'process.stdin.resume()'],
          env: { FOO: 'bar' },
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.toolsCount).toBe(2);
    expect(result.transport).toBe('stdio');
    expect(result.warnings).toBeUndefined();
  });

  it('should return warning when Claude mcp_config does not reference the JSON file', async () => {
    const result = await service.probeWithResolvedLocal({
      agentToolConfig: {
        toolId: 'claude-code',
        configJson: JSON.stringify({ mcp_config: ['/other/mcp.json'] }),
      },
      local: {
        name: 'demo',
        sourcePath: '/data/bl/mcp/mcp.json',
        config: {
          command: 'node',
          args: ['-e', 'process.stdin.resume()'],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([
      'AGENT_MCP_CONFIG_MAY_NOT_REFERENCE_BUSINESS_LINE_FILE',
    ]);
  });
});
