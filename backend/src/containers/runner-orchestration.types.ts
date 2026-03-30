export type RunnerNetworkMode = 'host' | 'bridge';

export type RunnerServiceConfig = {
  name: string;
  workdir: string;
  command: string;
  port?: number;
  env?: Record<string, string>;
  installCommand?: string;
  installCheckPath?: string;
  priority?: number;
  startsecs?: number;
  startretries?: number;
};

export type RunnerRouteMatchMode = 'prefix' | 'exact' | 'regex';
export type RunnerRouteAction = 'proxy' | 'redirect';

export type RunnerRouteConfig = {
  path: string;
  action?: RunnerRouteAction;
  match?: RunnerRouteMatchMode;
  service?: string;
  targetPort?: number;
  upstreamPath?: string;
  websocket?: boolean;
  redirectTo?: string;
  redirectCode?: number;
};

export type RunnerHomepageLinkConfig = {
  label: string;
  path: string;
};

export type RunnerHomepageConfig = {
  title?: string;
  description?: string;
  links?: RunnerHomepageLinkConfig[];
};

export type RunnerNamedVolumeConfig = {
  name: string;
  target: string;
};

export type RunnerOrchestrationConfig = {
  services: RunnerServiceConfig[];
  routes?: RunnerRouteConfig[];
  homepage?: RunnerHomepageConfig;
  sharedVolumes?: RunnerNamedVolumeConfig[];
};

export type ProjectRunnerConfigFile = {
  version: 1;
  project: {
    id: string;
    name: string;
    gitUrl: string;
    defaultBranch: string;
  };
  runtime: {
    networkMode: RunnerNetworkMode;
    hostIp: string;
    hostPort: number;
    containerPort: number;
    startTimeoutMs: number;
    resourceLimits?: {
      memoryMb?: number;
      pidsLimit?: number;
    };
    env?: Record<string, string>;
    sharedVolumes?: RunnerNamedVolumeConfig[];
  };
  orchestration: RunnerOrchestrationConfig;
};
