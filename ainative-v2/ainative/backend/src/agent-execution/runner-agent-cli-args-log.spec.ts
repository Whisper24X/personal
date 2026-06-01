import { summarizeAgentCliArgsForLog } from './runner-agent-cli-args-log';

describe('summarizeAgentCliArgsForLog', () => {
  it('should shorten paths following --mcp-config until the next flag', () => {
    const long = `${'/var/data/'.repeat(12)}business-line-1/mcp/mcp.json`;
    expect(long.length).toBeGreaterThan(64);
    const out = summarizeAgentCliArgsForLog([
      '-p',
      '--mcp-config',
      long,
      '/x.json',
      '--model',
      'x',
    ]);
    expect(out[0]).toBe('-p');
    expect(out[1]).toBe('--mcp-config');
    expect(out[2]).toMatch(/^…/);
    expect(out[3]).toBe('/x.json');
    expect(out[4]).toBe('--model');
    expect(out[5]).toBe('x');
  });

  it('should leave short mcp-config paths unchanged', () => {
    expect(
      summarizeAgentCliArgsForLog(['--mcp-config', '/tmp/a.json']),
    ).toEqual(['--mcp-config', '/tmp/a.json']);
  });
});
