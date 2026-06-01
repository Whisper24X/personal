import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';

@Injectable()
export class DockerExecProcessLauncherService {
  spawn(params: {
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
