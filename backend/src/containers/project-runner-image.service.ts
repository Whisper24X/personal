import { Injectable } from '@nestjs/common';
import { Project } from '../projects/domain/project';
import { ContainerExecutionConfigService } from './container-execution-config.service';

@Injectable()
export class ProjectRunnerImageService {
  constructor(
    private readonly containerConfig: ContainerExecutionConfigService,
  ) {}

  resolveRunnerImage(project?: Project | null): Promise<string> {
    void project;
    return Promise.resolve(this.containerConfig.getRunnerImage());
  }
}
