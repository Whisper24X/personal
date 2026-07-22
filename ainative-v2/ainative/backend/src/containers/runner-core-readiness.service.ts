import { Injectable } from '@nestjs/common';
import { IsolatedRunnerContainerService } from './isolated-runner-container.service';

export type RunnerCoreReadinessResult = {
  ready: boolean;
  error?: string;
};

@Injectable()
export class RunnerCoreReadinessService {
  constructor(
    private readonly isolatedRunner: IsolatedRunnerContainerService,
  ) {}

  async check(containerId: string): Promise<RunnerCoreReadinessResult> {
    try {
      await this.isolatedRunner.execInContainer(containerId, [
        'sh',
        '-lc',
        [
          'test -d /workspace',
          'test -r /workspace',
          'test -w /workspace',
          'command -v sh >/dev/null 2>&1 || command -v bash >/dev/null 2>&1',
          'command -v git >/dev/null 2>&1',
        ].join(' && '),
      ]);
      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
