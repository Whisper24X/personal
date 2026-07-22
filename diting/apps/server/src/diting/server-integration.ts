import { PreparedWorkspace, PullRequestRecord, RuntimePlugin, TaskPreflightResult, TitingTask } from "@diting/plugin-api";
import { ServiceDependencies } from "@diting/core";
import { ServerConfig } from "./config";
import { DependencyCheckService } from "./dependency-checks";
import { createPullRequestsForTask } from "./plugins/pull-request";
import { runTaskPreflight } from "./plugins/task-preflight";

export function buildServerServiceHooks(
  config: ServerConfig,
  plugins: RuntimePlugin[] = []
): Pick<ServiceDependencies, "runPreflight" | "createPullRequests"> {
  const dependencyChecks = new DependencyCheckService(plugins, { gitlab: config.plugins.gitlab });
  return {
    runPreflight: async (task: TitingTask): Promise<TaskPreflightResult> => runTaskPreflight(task, config, dependencyChecks),
    createPullRequests: async (task: TitingTask, workspace: PreparedWorkspace): Promise<PullRequestRecord[]> => (
      createPullRequestsForTask(task, workspace, config)
    )
  };
}
