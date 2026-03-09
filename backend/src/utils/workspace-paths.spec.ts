import path from 'path';
import { resolveAinativeDataRootDir } from './workspace-paths';

describe('resolveAinativeDataRootDir', () => {
  const originalDataRootDir = process.env.AINATIVE_DATA_ROOT_DIR;

  afterEach(() => {
    if (originalDataRootDir === undefined) {
      delete process.env.AINATIVE_DATA_ROOT_DIR;
      return;
    }

    process.env.AINATIVE_DATA_ROOT_DIR = originalDataRootDir;
  });

  it('should throw when the data root env is missing', () => {
    delete process.env.AINATIVE_DATA_ROOT_DIR;

    expect(() => resolveAinativeDataRootDir()).toThrow(
      'AINATIVE_DATA_ROOT_DIR is required',
    );
  });

  it('should keep explicit data root overrides', () => {
    process.env.AINATIVE_DATA_ROOT_DIR = '/tmp/custom-ainative-data';

    expect(resolveAinativeDataRootDir()).toBe(
      path.resolve('/tmp/custom-ainative-data'),
    );
  });
});
