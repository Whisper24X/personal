import { TaskGitService } from './task-git.service';

describe('TaskGitService', () => {
  it('should expand untracked directories into file paths when reading git status', async () => {
    const service = new TaskGitService({} as any, {} as any);

    jest
      .spyOn(service as any, 'resolveTaskGitContext')
      .mockResolvedValue({
        task: {
          gitBaseBranch: 'main',
        },
        worktreePath: '/tmp/worktree',
      });

    const runGitCommand = jest
      .spyOn(service as any, 'runGitCommand')
      .mockImplementation(async (_cwd: string, args: string[]) => {
        if (args[0] === 'status') {
          expect(args).toEqual([
            'status',
            '--porcelain',
            '--untracked-files=all',
          ]);

          return {
            success: true,
            stdout: '?? docs/feature/20260319-111330/brainstorm.md',
            stderr: '',
            exitCode: 0,
          };
        }

        if (args[0] === 'rev-parse') {
          return {
            success: true,
            stdout: 'feature/test-branch',
            stderr: '',
            exitCode: 0,
          };
        }

        throw new Error(`Unexpected git args: ${args.join(' ')}`);
      });

    const result = await service.getStatus('task-1', {} as any);

    expect(runGitCommand).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      branchName: 'feature/test-branch',
      baseBranch: 'main',
      files: [
        {
          path: 'docs/feature/20260319-111330/brainstorm.md',
          status: '??',
          staged: false,
        },
      ],
    });
  });
});
