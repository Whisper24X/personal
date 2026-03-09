import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

const workspaceMarkers = ['.git', '.trellis', 'AGENTS.md'];
const configService = new ConfigService();

const hasWorkspaceMarker = (directory: string): boolean => {
  return workspaceMarkers.some((marker) =>
    existsSync(path.join(directory, marker)),
  );
};

export const resolveWorkspaceRootDir = (startDir = process.cwd()): string => {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (hasWorkspaceMarker(currentDir)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(startDir);
    }

    currentDir = parentDir;
  }
};

const expandHomePath = (inputPath: string): string => {
  const trimmedPath = inputPath.trim();

  if (trimmedPath === '~') {
    return os.homedir();
  }

  if (trimmedPath.startsWith('~/')) {
    return path.join(os.homedir(), trimmedPath.slice(2));
  }

  return trimmedPath;
};

export const resolveAinativeDataRootDir = (): string => {
  const configuredPath = configService
    .get<string>('AINATIVE_DATA_ROOT_DIR', { infer: true })
    ?.trim();

  if (!configuredPath) {
    throw new Error(
      'AINATIVE_DATA_ROOT_DIR is required. Set it in the active backend .env file.',
    );
  }

  return path.resolve(expandHomePath(configuredPath));
};
