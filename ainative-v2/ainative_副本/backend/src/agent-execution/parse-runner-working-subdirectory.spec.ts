import path from 'path';
import {
  parseRunnerWorkingSubdirectory,
  parseRunnerWorkingSubdirectoryFromConfigJson,
} from './parse-runner-working-subdirectory';

describe('parseRunnerWorkingSubdirectory', () => {
  it('should return null for empty or non-string', () => {
    expect(parseRunnerWorkingSubdirectory(undefined)).toBeNull();
    expect(parseRunnerWorkingSubdirectory(null)).toBeNull();
    expect(parseRunnerWorkingSubdirectory('')).toBeNull();
    expect(parseRunnerWorkingSubdirectory('   ')).toBeNull();
    expect(parseRunnerWorkingSubdirectory(1)).toBeNull();
  });

  it('should normalize relative segments', () => {
    expect(parseRunnerWorkingSubdirectory('packages/app')).toBe(
      path.join('packages', 'app'),
    );
    expect(parseRunnerWorkingSubdirectory('yanxue-main')).toBe('yanxue-main');
  });

  it('should reject absolute paths and ..', () => {
    expect(() => parseRunnerWorkingSubdirectory('/abs')).toThrow(
      'relative path',
    );
    expect(() => parseRunnerWorkingSubdirectory('a/../b')).toThrow(
      '. or .. path segments',
    );
    expect(() => parseRunnerWorkingSubdirectory('..')).toThrow(
      '. or .. path segments',
    );
  });
});

describe('parseRunnerWorkingSubdirectoryFromConfigJson', () => {
  it('should read runnerWorkingSubdirectory', () => {
    expect(
      parseRunnerWorkingSubdirectoryFromConfigJson({
        runnerWorkingSubdirectory: 'pkg/foo',
      }),
    ).toBe(path.join('pkg', 'foo'));
  });

  it('should return null when missing', () => {
    expect(parseRunnerWorkingSubdirectoryFromConfigJson({})).toBeNull();
    expect(parseRunnerWorkingSubdirectoryFromConfigJson(null)).toBeNull();
  });
});
