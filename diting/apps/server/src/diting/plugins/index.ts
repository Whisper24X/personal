/**
 * Built-in Diting plugins: file logs, task integration, workspace prep, agents, quality, governance.
 * Order in {@link createBuiltinPlugins} is stable for listing; capability/priority selection uses `PluginRuntime`.
 */
import { ServerConfig } from "../config";
import { PluginKind, RuntimePlugin } from "@diting/plugin-api";
import { DefaultOpenSpecCompletionGatePlugin } from "./completion-gate";
import {
  CodexExecutionPlugin,
  CursorExecutionPlugin,
  ProductCodexExecutionPlugin,
  ProductCursorExecutionPlugin,
  QualityCodexExecutionPlugin,
  QualityCursorExecutionPlugin
} from "./execution";
import { discoverCodingRuntimeDescriptors } from "./coding-runtime-discovery";
import { LocalWorktreeEnvironmentPlugin } from "./environment";
import { GitLabCliIntegrationPlugin } from "./gitlab";
import { DefaultObservabilityGovernancePlugin } from "./governance";
import { RootLogsPlugin } from "./log";
import { MeegleTaskIntegrationPlugin } from "./meegle";
import { DefaultQualityPlugin } from "./quality";

export {
  CodexExecutionPlugin,
  CursorExecutionPlugin,
  ProductCodexExecutionPlugin,
  ProductCursorExecutionPlugin,
  QualityCodexExecutionPlugin,
  QualityCursorExecutionPlugin
} from "./execution";
export { DefaultOpenSpecCompletionGatePlugin } from "./completion-gate";
export { EnvironmentPreparationError, LocalWorktreeEnvironmentPlugin } from "./environment";
export { GitLabCliIntegrationPlugin } from "./gitlab";
export { DefaultObservabilityGovernancePlugin } from "./governance";
export { RootLogsPlugin } from "./log";
export { MeegleTaskIntegrationPlugin, parseOpenSpecReviewReply } from "./meegle";
export { DefaultQualityPlugin } from "./quality";
export { createSkeletonPlugins } from "./skeletons";

export type BuiltinPluginGroups = Record<
  "log" | "task-integration" | "environment" | "agent" | "completion-gate" | "quality" | "observability-governance" | "platform",
  RuntimePlugin[]
>;

/**
 * Instantiates the default plugin stack grouped by kind so individual kinds can be overridden by external packages.
 * `governance` is passed into Codex/Cursor so `beforeCommand` / `afterCommand` wrap each CLI invocation.
 */
export async function createBuiltinPluginGroups(config: ServerConfig): Promise<BuiltinPluginGroups> {
  const governance = new DefaultObservabilityGovernancePlugin(config.governance);
  const codingRuntimeDescriptors = await discoverCodingRuntimeDescriptors(config);
  const agentPlugins: RuntimePlugin[] = [];
  for (const descriptor of codingRuntimeDescriptors) {
    if (descriptor.runtime === "codex") {
      agentPlugins.push(new CodexExecutionPlugin(
        config.plugins.execution.codexBin,
        config.goalRecovery.executionTimeoutMs,
        governance,
        config.goalRecovery.executionIdleTimeoutMs,
        descriptor
      ));
      agentPlugins.push(new ProductCodexExecutionPlugin(
        config.plugins.execution.codexBin,
        config.goalRecovery.executionTimeoutMs,
        governance,
        config.goalRecovery.executionIdleTimeoutMs,
        {
          ...descriptor,
          id: "openspec-product-codex",
          displayName: "OpenSpec Product Codex",
          priority: descriptor.priority + 1
        }
      ));
      agentPlugins.push(new QualityCodexExecutionPlugin(
        config.plugins.execution.codexBin,
        config.goalRecovery.executionTimeoutMs,
        governance,
        config.goalRecovery.executionIdleTimeoutMs,
        {
          ...descriptor,
          id: "quality-orchestrator-codex",
          displayName: "Quality Orchestrator Codex",
          priority: descriptor.priority + 2
        }
      ));
      continue;
    }
    agentPlugins.push(new CursorExecutionPlugin(
      config.plugins.execution.cursorBin,
      config.goalRecovery.executionTimeoutMs,
      governance,
      config.goalRecovery.executionIdleTimeoutMs,
      descriptor
    ));
    agentPlugins.push(new ProductCursorExecutionPlugin(
      config.plugins.execution.cursorBin,
      config.goalRecovery.executionTimeoutMs,
      governance,
      config.goalRecovery.executionIdleTimeoutMs,
      {
        ...descriptor,
        id: "openspec-product-cursor",
        displayName: "OpenSpec Product Cursor",
        priority: descriptor.priority
      }
    ));
    agentPlugins.push(new QualityCursorExecutionPlugin(
      config.plugins.execution.cursorBin,
      config.goalRecovery.executionTimeoutMs,
      governance,
      config.goalRecovery.executionIdleTimeoutMs,
      {
        ...descriptor,
        id: "quality-orchestrator-cursor",
        displayName: "Quality Orchestrator Cursor",
        priority: descriptor.priority + 1
      }
    ));
  }
  return {
    log: [new RootLogsPlugin()],
    "task-integration": [new MeegleTaskIntegrationPlugin(config)],
    environment: [new LocalWorktreeEnvironmentPlugin(config)],
    agent: agentPlugins,
    "completion-gate": [new DefaultOpenSpecCompletionGatePlugin()],
    quality: [new DefaultQualityPlugin(config.goalRecovery.qualityTimeoutMs)],
    "observability-governance": [governance],
    platform: [new GitLabCliIntegrationPlugin(config)]
  };
}

/**
 * Instantiates the default plugin stack: root logs → Meegle → env → agents(Codex/Cursor) → quality → governance.
 * `governance` is passed into Codex/Cursor so `beforeCommand` / `afterCommand` wrap each CLI invocation.
 */
export async function createBuiltinPlugins(config: ServerConfig) {
  const groups = await createBuiltinPluginGroups(config);
  return [
    ...groups.log,
    ...groups["task-integration"],
    ...groups.environment,
    ...groups.agent,
    ...groups["completion-gate"],
    ...groups.quality,
    ...groups["observability-governance"],
    ...groups.platform
  ];
}
