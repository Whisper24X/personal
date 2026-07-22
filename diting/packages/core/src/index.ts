/**
 * `@diting/core` 公共导出入口：领域服务、插件编排、状态机与可观测/仓储相关工具。
 *
 * 典型装配：`PluginRuntime`（插件选择与策略） + `TitingServices`（任务/调度/执行闭环）。
 */
export * from "./diting/errors";
export * from "./diting/state-machine";
export * from "./diting/plugin-runtime";
export * from "./diting/services";
export * from "./diting/task-command-service";
export * from "./diting/task-query-service";
export * from "./diting/scheduler-service";
export * from "./diting/execution-orchestrator";
export * from "./diting/repair-loop-service";
export * from "./diting/human-intervention-service";
export * from "./diting/plugin-admin-service";
export * from "./diting/plugin-capability-router";
export * from "./diting/plugin-policy-engine";
export * from "./diting/plugin-lifecycle-manager";
export * from "./diting/domain-models";
export * from "./diting/domain-mappers";
export * from "./diting/failure-repair-service";
export * from "./diting/in-memory-run-attempt-repository";
export * from "./diting/service-shared";
