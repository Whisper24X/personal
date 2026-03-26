import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';

@Injectable()
export class AgentProcessLauncherService {
  /**
   * Run a command inside the task runner container; returns the docker exec child process
   * (same shape as a direct CLI spawn) so AgentRunnerService can reuse stream/interrupt logic.
   */
  spawnViaDockerExec(params: {
    containerRef: string;
    command: string;
    args: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
  }): ChildProcess {
    const execArgs = ['exec', '-i', '-w', params.cwd];

    for (const [key, value] of Object.entries(params.env)) {
      if (value === undefined || value === null) {
        continue;
      }
      execArgs.push('-e', `${key}=${String(value)}`);
    }

    execArgs.push(params.containerRef, params.command, ...params.args);

    return spawn('docker', execArgs, {
      stdio: 'pipe',
    });
  }
}
