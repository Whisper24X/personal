# devices-learn 迁移任务清单

> 每个任务一句话；详情见对应 `openspec/changes/<change-id>/`（proposal/specs/tasks/design）。
> 总纲：`docs/superpowers/specs/2026-06-17-devices-learn-migration-design.md`。
> **执行顺序：按下方 1→6 顺序推进（低风险→高风险，1 先跑通流程并确立 DI 模式，后续套用）。**

- [ ] **1. migrate-learn-config**（pilot，5 接口）：按 master 补齐 learn_config 5 个 RPC 并确立「UseCase 注入 Repo + make wire」DI 模式。
- [ ] **2. migrate-dynamic-config**（17 接口）：补齐 dynamic_learn / function / dock(v1+v2) 表驱动配置的列表/保存/状态变更。
- [ ] **3. migrate-style-target-task**（9 接口）：补齐 style/target/task，并保留「创建风格/目标后触发任务完成」联动，第三方接口入 data/rpc。
- [ ] **4. migrate-proxy-diagnosis**（17 接口）：补齐 user/desktop/course_learn/diagnosis 聚合代理查询，外部服务统一封装到 data/rpc。
- [ ] **5. migrate-nps**（12 接口）：补齐 NPS 弹窗/提交/多维统计/汇总，并恢复 MQ consumer、Cron summary 与下载路由。
- [ ] **6. migrate-homework-assistant**（18 接口）：补齐搜题/批改/错题订正/分数排行/异步搜题，第三方(yc_oss/TAL/OpenAI/搜索)入 data/rpc，恢复排行 Cron。

## 顺序理由

1. **learn-config 最先**：纯表驱动、无外部依赖，最适合作 pilot 跑通 backend-dev 全流程并确立 DI 基线模式。
2. **dynamic-config 次之**：同为表驱动配置，直接复用 1 的 DI 模式，风险低。
3. **style-target-task**：首次引入第三方调用（data/rpc）与跨 domain 联动副作用，承上启下。
4. **proxy-diagnosis**：大量无表/聚合代理，外部依赖更重，在 3 建立 rpc 封装经验后进行。
5. **nps**：在业务接口外新增 MQ/Cron/下载路由，需先有稳定的 server 装配经验。
6. **homework-assistant 最后**：接口最多、第三方最杂（OSS/TAL/OpenAI）、含异步与排行 Cron，复杂度最高，放最后收尾。
