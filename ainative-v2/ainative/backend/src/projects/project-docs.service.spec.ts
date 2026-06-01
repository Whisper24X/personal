import { promises as fs } from 'fs';
import { BadRequestException } from '@nestjs/common';
import os from 'os';
import path from 'path';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectDocsService } from './project-docs.service';

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

describe('ProjectDocsService', () => {
  let tempRoot: string;

  afterEach(async () => {
    jest.restoreAllMocks();
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('should read a missing goal doc from the remote branch without restoring it locally', async () => {
    const projectId = 'project-1';
    const goalId = 'daa73745-cd01-48a2-b554-508ad7a52b27';
    const docPath = `goals/${goalId}/PRD.md`;
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ainative-docs-'));

    const workspaceService = {
      ensureProjectRepositoryReady: jest.fn().mockResolvedValue({
        repositoryRoot: tempRoot,
      }),
      normalizeProjectDocPath: jest.fn((value: string) => value.trim()),
      runWithProjectRepositoryLock: jest.fn(
        async (
          _projectId: string,
          _currentUser: JwtPayloadType,
          _options: unknown,
          operation: (ctx: { repositoryRoot: string }) => Promise<unknown>,
        ) => operation({ repositoryRoot: tempRoot }),
      ),
    };
    const goalRepository = {
      findById: jest.fn().mockResolvedValue({
        id: goalId,
        projectId,
        gitBranch: 'feature/goal-prd',
      }),
    };
    const service = new ProjectDocsService(
      workspaceService as never,
      goalRepository as never,
    );
    jest
      .spyOn(
        service as unknown as {
          runGitCommand: () => Promise<{
            success: boolean;
            stdout: string;
            stderr: string;
          }>;
        },
        'runGitCommand',
      )
      .mockResolvedValue({
        success: true,
        stdout: '# PRD\n\n## 背景',
        stderr: '',
      });

    const result = await service.readDoc(projectId, docPath, createJwt());

    expect(result).toEqual(
      expect.objectContaining({
        path: docPath,
        name: 'PRD.md',
        content: '# PRD\n\n## 背景',
      }),
    );
    await expect(
      fs.readFile(path.join(tempRoot, 'docs', docPath), 'utf-8'),
    ).rejects.toThrow();
    expect(workspaceService.runWithProjectRepositoryLock).toHaveBeenCalledWith(
      projectId,
      expect.anything(),
      { syncRemote: true },
      expect.any(Function),
    );
  });

  it('should not read from remote when the local goal doc exists but cannot be read', async () => {
    const projectId = 'project-1';
    const goalId = 'daa73745-cd01-48a2-b554-508ad7a52b27';
    const docPath = `goals/${goalId}/PRD.md`;
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ainative-docs-'));
    const absolutePath = path.join(tempRoot, 'docs', docPath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, '# local', 'utf-8');

    const workspaceService = {
      ensureProjectRepositoryReady: jest.fn().mockResolvedValue({
        repositoryRoot: tempRoot,
      }),
      normalizeProjectDocPath: jest.fn((value: string) => value.trim()),
      runWithProjectRepositoryLock: jest.fn(),
    };
    const goalRepository = {
      findById: jest.fn(),
    };
    const service = new ProjectDocsService(
      workspaceService as never,
      goalRepository as never,
    );
    const runGitSpy = jest.spyOn(
      service as unknown as {
        runGitCommand: () => Promise<{
          success: boolean;
          stdout: string;
          stderr: string;
        }>;
      },
      'runGitCommand',
    );
    jest.spyOn(fs, 'readFile').mockRejectedValueOnce(
      Object.assign(new Error('EPERM: operation not permitted'), {
        code: 'EPERM',
      }),
    );

    await expect(
      service.readDoc(projectId, docPath, createJwt()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      workspaceService.runWithProjectRepositoryLock,
    ).not.toHaveBeenCalled();
    expect(goalRepository.findById).not.toHaveBeenCalled();
    expect(runGitSpy).not.toHaveBeenCalled();
  });
});
