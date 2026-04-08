import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';

@Injectable()
export class LocalProcessLauncherService {
  spawn(params: {
    command: string;
    args: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
  }): ChildProcess {
    return spawn(params.command, params.args, {
      cwd: params.cwd,
      env: params.env,
      stdio: 'pipe',
    });
  }
}
