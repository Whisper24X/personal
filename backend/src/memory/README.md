# Memory（对话知识沉淀）

Nest 模块路径：`memory.module.ts`。

- **ingest**：`DefaultMemoryIngestPlugin` — 转录 → 候选池 →（可选 LLM）事实 → 门限 →（可选 LLM）补丁 → `docs/memory/`。
- **inject**：`DefaultMemoryInjectPlugin` — L0 README、L1 `_routing.yaml`、L2 按 query 节评分。
- **Worker**：`MemoryIngestWorkerService` 轮询 `memory_ingest_jobs`。
- **入队端口**：`MEMORY_INGEST_ENQUEUE`（`MemoryIngestEnqueueService`），由 `TaskStatusService` 在 `done` 时触发。

详细环境变量与运维说明见仓库 `docs/technical/知识沉淀-插件使用说明.md`。
