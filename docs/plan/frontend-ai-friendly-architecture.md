# 前端 AI 友好型架构优化方案

## 文档定位

这份文档定义的是 `frontend/src` 的目标结构、迁移边界和落地顺序。

它不是“一次性重写计划”，而是一份兼容迁移方案：

- 当前代码库和已生效的 `docs/dev-spec/` 仍然是现状阶段的 source of truth
- 当某个目录切片开始迁移时，本方案才成为该切片的目标结构依据
- 每个迁移 Phase 完成后，都要同步更新 `AGENTS.md` 与对应 dev spec，避免文档与代码分叉

特别说明：

- 当前已生效的 CLI 渲染器边界约束见 `docs/dev-spec/frontend/frontend-cli-renderer-boundaries.md`
- 在 `tasks/detail/cli` 真正迁移之前，该规范仍以当前路径为准
- 迁移 `tasks/detail/cli` 的同一个 PR 中，必须同步更新该 dev spec 的作用路径

## 背景

当前 `frontend/src` 的主要问题，不是目录数量多，而是目录划分维度混杂。

现状同时存在三类拆分方式：

- 按技术类型拆分：`components`、`hooks`、`utils`、`types`、`keys`、`workers`
- 按业务域拆分：`tasks`、`skills`、`business-lines`、`mcp`
- 按页面入口拆分：`views/*`

这三种方式单独使用都可以，但混合后会持续制造同一个问题：

`这个文件到底该放哪里？`

这个问题会同时伤害 AI 编码和人工 review：

- AI 难以稳定判断落点，容易跨多层目录来回跳转
- 小需求经常需要同时修改 `views`、`components`、`hooks`、`utils`、`keys`
- 共享抽象容易提前发生，或者被放进错误的顶层技术目录
- review 很难仅凭路径判断职责、越层依赖和重复实现

当前仓库里已经出现了几个典型信号：

- 页面文件承担了大量业务编排和状态管理
- `components/business/settings` 已经变成跨业务聚集区
- `hooks/core`、`keys`、`workers` 承载了明显的 feature 私有能力
- 目录命名和真实职责之间已经出现偏移

因此，本次优化的目标不是引入更“先进”的术语，而是建立一套低歧义、边界稳定、便于 AI 和人协作的前端结构。

## 优化目标

- 让 AI 能基于业务词快速定位修改目录
- 让一个需求尽量在单个 feature 或单个 feature slice 内闭合
- 让页面层、业务层、共享层、访问层的职责边界清晰
- 让状态归属可判断，避免“逻辑搬家后仍然耦合”
- 让 review 能快速判断是否越层、是否 deep import、是否污染共享层
- 让迁移过程支持新旧结构共存，而不是要求一次性切换

一句话目标：

`让责任边界肉眼可见，让状态归属可判断，让改动天然局部化。`

## 核心决策

### 1. `frontend/src` 收敛为五个顶层分区

目标不是继续强化顶层技术分类，而是收敛为：

- `app`：应用装配层
- `pages`：页面入口层
- `features`：业务能力层
- `api`：后端访问层
- `shared`：稳定共享层

其中：

- `app`、`pages`、`features`、`shared` 是四个职责分区
- `api` 是独立的访问层，平级存在，不并入 `shared`

这样做的原因是：

- `api` 与后端模块和 HTTP 基础设施强耦合，职责与 `shared` 不同
- `shared` 应保持业务中性，而 `api` 明确面向后端访问
- AI 在修改接口调用时，需要一个集中且稳定的访问层入口

### 2. 新代码默认 `feature first`

新增代码按以下默认顺序判断落点：

1. 应用启动、路由装配、全局注册、全局壳层：放 `app`
2. 路由页面入口：放 `pages`
3. 某个业务域专属能力：放对应 `features/*`
4. 后端请求与访问基础设施：放 `api`
5. 跨多个 feature 复用、语义稳定、无业务词：放 `shared`

如果拿不准：

- 默认先放 `features/*`
- 不提前抽到 `shared`

### 3. 允许跨 feature 引用，但只允许通过公开入口

本方案不采用“feature 之间完全绝对隔离”的口径。

原因很简单：真实业务存在单向依赖，例如：

- `tasks` 需要读取 `business-lines` 的选择能力
- `business-lines` 可能组合 `skills`、`mcp`、`workflow`
- Dashboard 天然会聚合多个 feature 的公开能力

因此，规则改为：

- 允许 feature 之间发生**单向依赖**
- 只允许通过 feature 的**公开入口**导入
- 禁止 deep import 到别的 feature 内部路径
- 禁止互相双向依赖
- 一旦出现双向依赖，应上提到 `shared`、抽成更高层组合，或重新划分 feature 边界

### 4. 迁移采用“兼容期优先”，不做大爆炸式重构

本次迁移必须允许新旧结构并存一段时间。

因此：

- 先建立别名、source of truth 和 lint 守护
- 再迁目录
- 再按业务域收口
- 最后清理旧路径

不是所有旧目录都会在一个 Phase 内消失。

## 设计原则

### 1. 优先按职责边界拆，而不是按技术类型拆

技术分类适合描述“代码长什么样”，但不适合表达“代码归谁负责”。

因此，顶层不再以 `components/hooks/utils/types` 作为主要边界，而以业务和职责边界为主。

### 2. 页面层只负责编排，不承载长期业务实现

`pages/*` 只承担：

- 路由页面入口
- 路由参数读取
- 页面级异步编排
- feature 组合

不在页面层沉淀长期复用业务逻辑，也不把页面写成新的“超级组件”。

### 3. `shared` 必须克制

只有同时满足以下条件的代码，才允许进入 `shared`：

- 跨多个 feature 复用
- 语义稳定
- 没有明确业务词

否则优先保留在 feature 内。

### 4. 命名必须表达职责，而不是表达抽象姿态

避免继续扩散以下弱语义命名：

- `core`
- `common`
- `business`
- `helper`
- `manager`

更推荐的命名方式：

- `workspace.context.ts`
- `notification-sse.worker.ts`
- `useProjectSelection.ts`
- `task-step-summary.store.ts`

命名的目标不是优雅，而是让 AI 和人仅凭路径与文件名就能建立大部分上下文判断。

### 5. 状态归属必须显式

目录重构不能只解决“文件放哪”，还必须解决“状态归谁”。

否则只是把耦合关系从一个目录搬到另一个目录。

### 6. 测试文件跟随被测代码迁移

测试和源码的归属必须一致。

规则：

- 单元测试优先就近共置
- 可以与源码同级，也可以放在同级 `__tests__/`
- 迁移源码时，测试文件必须一起移动

## 目标结构

推荐将 `frontend/src` 收敛为以下结构：

```text
frontend/src
  app/
    App.vue
    main.ts
    router/
    stores/
    config/
    directives/
    layouts/
  pages/
    home/
    dashboard/
    tasks/
    projects/
    settings/
    skills/
    mcp/
    business-lines/
  features/
    layout/
    notifications/
    tasks/
      create/
      detail/
        components/
        composables/
        model/
        cli/
          codex/
          claude-code/
          cursor-agent/
          gemini/
          opencode/
          shared/
    business-lines/
    skills/
    mcp/
    workflow/
    settings/
    access/
  api/
    tasks/
    projects/
    business-lines/
    skills/
    mcp/                  # 若需要镜像后端模块，也可使用 mcps/
    shared/
  shared/
    ui/
    components/
    composables/
    utils/
    types/
    constants/
    assets/
    locales/
    lib/
```

说明：

- `shared/components` 不是新的总桶目录，只收纳跨 feature 复用、语义稳定的复合无业务组件
- `features/*` 下可以继续按子功能分层，例如 `tasks/detail`
- `tasks/detail/cli/<provider>` 的深层嵌套属于明确批准的例外，不适用一般的目录深度建议

## 各层职责定义

### app

职责：

- 应用启动
- 路由装配
- 全局 store 注册
- 全局 directives 注册
- 布局壳层装配

规则：

- 不放 feature 私有业务逻辑
- 不放 feature 私有 worker、context、业务工具
- `app/layouts` 只放结构性页面壳组件，不放 feature 业务逻辑

### pages

职责：

- 路由页面入口
- URL、route params、query 的读取与同步
- 页面级数据拉取编排
- feature 组合

规则：

- 不沉淀跨页面复用业务实现
- 不直接承担大块业务状态管理
- 不直接 deep import 到其他 feature 的内部路径

### features

职责：

- 承载业务能力的主要实现
- 组织组件、composable、模型、store、worker 和 feature 工具函数

规则：

- 一个 feature 内允许拥有自己的 `components`、`composables`、`model`、`stores`、`utils`
- feature 专属能力不需要先放到共享层
- 对外暴露能力时通过 feature 的公开入口导出

### api

职责：

- 封装所有后端 HTTP 请求
- 维护请求/响应拦截器、鉴权 token、错误处理等基础设施
- 按后端模块组织访问代码

规则：

- `api` 只做访问和必要的数据转换，不做业务编排
- `api/shared` 只放访问基础设施
- `api` 不依赖 `features`、`pages`、`app`

### shared

职责：

- 纯基础 UI
- 复用率高且稳定的无业务组件
- 通用类型
- 通用常量
- 国际化资源
- 静态资源
- 对第三方库的通用适配层

规则：

- `shared` 只允许依赖自身和外部 npm 包
- 不允许出现带业务词的实现
- 不把 `shared/components` 当作“暂时不知道放哪”的缓冲区

## 依赖规则

### 依赖方向

允许的依赖关系如下：

```text
app      -> pages, features(public API), api, shared
pages    -> features(public API), api, shared
features -> api, shared, other-features(public API only)
api      -> shared
shared   -> shared, npm packages
```

禁止的依赖关系：

- `pages` 导入其他 `pages`
- `features` deep import 到其他 `features` 的内部目录
- `features` 与 `features` 相互双向依赖
- `api` 导入 `features`、`pages`、`app`
- `shared` 导入 `api`、`features`、`pages`、`app`

### 公开入口规则

跨 feature 引用时，统一使用公开入口文件。

推荐做法：

- feature 需要对外暴露能力时，提供 `index.ts`
- 如果某个子功能本身需要单独对外暴露，可以使用子级 `index.ts`
- feature 外部消费者只允许从这些入口导入

示例：

- 合法：`@/features/tasks/index`
- 合法：`@/features/tasks/detail/index`
- 非法：`@/features/tasks/detail/model/task-step.model`
- 非法：`@/features/business-lines/components/BusinessLineFormModal.vue`

补充规则：

- `index.ts` 是公开边界，不是强制性的“大而全 barrel”
- 只有当某个 feature slice 确实需要被外部消费时，才建立公开入口
- 公开入口应保持轻薄，避免把整个 feature 内部结构重新暴露出去
- 兼容期内，对尚未迁移到新结构的旧切片不强制补公开入口；但一旦某个切片进入新结构，就必须补齐公开入口并禁止继续 deep import

## 状态与数据流归属

这是本方案新增的强约束。

### 状态归属矩阵

| 场景 | 归属位置 | 说明 |
|------|---------|------|
| 组件局部 UI 状态 | 组件内部 | 例如弹窗开关、hover、临时输入值 |
| 页面 URL / query / route params | `pages/*` | 页面负责解析 URL，并把结果传给 feature |
| 单一业务流程、可复用的状态与副作用 | `features/*/composables` | composable 负责封装流程，不要隐藏跨域副作用 |
| 同一 feature 内多个组件共享的业务状态 | `features/*/stores` | 仅在该 feature 内共享时使用 feature store |
| 全局用户态、权限、应用配置、跨域偏好 | `app/stores` | 例如 auth、user、app config、全局 UI 偏好 |
| 同一 feature 深层组件树的上下文传递 | `features/*/model/*.context.ts` | 使用 typed `InjectionKey`，并由 provider 持有变更能力 |
| Feature 专属 worker / SSE / websocket 生命周期 | 对应 feature 的 composable/store + worker 文件 | worker 文件跟 feature 共置，不挂顶层 |

### 数据流规则

- 默认遵循 `props down, events up`
- 只有当 props 传递层级明显过深，且作用范围明确属于同一 feature 时，才使用 provide/inject
- composable 可以封装副作用，但不应隐式修改无关外部状态
- store 不是事件总线，不用来掩盖 feature 之间的耦合
- 跨 feature 通信优先顺序：
  1. 页面层显式组合与传参
  2. 通过另一个 feature 的公开 API 获取能力
  3. 只有确实属于全局共享状态时，才上升为 `app/stores`

### `app/layouts` 与 `features/layout` 的边界

这两个目录必须严格区分：

- `app/layouts`：结构性的 layout 壳组件，只负责 `<RouterView />`、`<slot />`、外层框架和 route meta 装配
- `features/layout`：sidebar、workspace 选择、header 用户菜单、breadcrumb 等带业务交互与状态的布局能力

判断标准：

- 只做页面壳编排：放 `app/layouts`
- 含状态、权限、业务菜单、工作区逻辑：放 `features/layout`

## 命名与目录约定

### 目录命名

- 页面和 feature 目录优先使用前端产品语义
- `api/*` 子目录优先镜像后端模块命名
- 不为了表面统一，强行让前端域目录和后端 API 模块目录完全同形

这意味着：

- `features/business-lines`、`pages/business-lines` 是合理的
- `api/mcps` 如果需要保持与后端模块一致，也可以接受

关键要求不是“所有目录长得完全一样”，而是：

- 同一层内命名稳定
- 一个名字只表达一种职责
- 迁移前先维护明确的命名对照表

### 文件命名

| 文件类型 | 命名模式 | 示例 |
|---------|---------|------|
| 组件 | `PascalCase.vue` | `TaskCreatePanel.vue` |
| composable | `use<Name>.ts` | `useTaskSelection.ts` |
| context | `<name>.context.ts` | `workspace.context.ts` |
| store | `<name>.store.ts` | `task-list.store.ts` |
| model | `<name>.model.ts` | `task-step.model.ts` |
| worker | `<name>.worker.ts` | `notification-sse.worker.ts` |
| 常量 | `<name>.constants.ts` 或 `constants.ts` | `access.constants.ts` |
| 测试 | `<name>.spec.ts` | `parser.spec.ts` |

### 弃用的顶层技术目录

中长期目标是移除或停止新增以下顶层技术碎片目录：

- `views`
- `hooks`
- `keys`
- `workers`
- `enums`

约束：

- 迁移开始后，不允许再向这些旧目录新增同域新文件
- 旧目录在兼容期内可以暂存存量代码，但不再作为新结构的落点

## Feature 内部结构契约

推荐的 feature 结构如下：

```text
features/<feature-name>/
  components/
  composables/
  model/
  stores/
  utils/
  constants/
  __tests__/
  index.ts
```

规则：

- 不是所有子目录都必须存在，按需创建
- 默认不单独创建 `types/` 子目录
- feature 专属类型优先放在 `model/`
- 只有当 `model/` 文件数量明显过多，且类型已形成稳定子域时，才允许再拆 `types/`
- `index.ts` 只在需要对外暴露能力时创建
- 子功能目录也遵循同样契约，例如 `features/tasks/detail`

这样做的原因是：

- `model/` 与 `types/` 同时常驻时，很容易再次制造“这个类型到底该放哪”的判断成本
- 先收敛到 `model/`，能让 AI 和 reviewer 的判断更稳定

## 当前目录的具体调整建议

### 1. `views` 改为 `pages`

原因：

- 当前 `views/*` 实际承担的是路由页面入口
- `pages` 比 `views` 更能表达职责
- 与 `features` 的边界更清晰

规则：

- 页面入口保留在 `pages/*`
- 页面内可保留少量页面私有片段
- 可复用业务实现必须下沉到 `features/*`

### 2. `components` 拆成 `shared` 与 `features`

建议：

- `components/ui` 迁到 `shared/ui`
- `components/core/file-browser`、`components/core/select` 这类稳定中性能力迁到 `shared/components`
- `components/tasks/*` 迁到 `features/tasks/*`
- `components/business/settings/*` 按真实归属拆到 `features/business-lines`、`features/skills`、`features/mcp`、`features/workflow`、`features/settings`
- `components/access/*` 迁到 `features/access/*`
- `components/core/layouts/*` 按职责拆到 `app/layouts` 和 `features/layout`

额外约束：

- `shared/components` 必须按能力子目录组织
- 不再新增 `core`、`common`、`business` 这类边界含糊的大目录

### 3. `hooks` 改为 `composables`

原因：

- 这是 Vue 3 更稳定的约定
- 能减少 React `hooks` 语义对 Vue 组合式 API 的表意干扰

迁移规则：

- 通用能力迁到 `shared/composables`
- feature 专属能力迁到 `features/*/composables`

### 4. 移除顶层 `keys`

原则：

- `InjectionKey` 与所属 feature 共置
- 统一命名为 `*.context.ts`
- context 文件默认放在 `features/*/model`

### 5. 移除顶层 `workers`

原则：

- 单个 worker 不应独立占据顶层目录
- feature 专属 worker 跟 feature 共置
- 只有未来出现多个稳定跨 feature worker，才考虑 `shared/workers`

### 6. `stores` 拆成全局 store 与 feature store

规则：

- 全局用户态、权限、应用配置、全局偏好：放 `app/stores`
- 单一业务域共享状态：放 `features/*/stores`
- 页面临时编排态不直接上升为 store

### 7. `types`、`constants`、`enums` 重新收口

规则：

- 通用纯类型放 `shared/types`
- feature 私有类型放 `features/*/model`
- 通用常量和枚举放 `shared/constants`
- 业务常量和枚举放 `features/*/constants`

说明：

- 枚举是值，不应默认归入 `types`
- 旧的顶层 `enums` 目录不再作为长期边界存在

### 8. `utils` 与 `lib` 分流

规则：

- 纯工具函数放 `shared/utils`
- 第三方库适配、封装层放 `shared/lib`
- 带业务语义的工具函数跟 feature 共置
- `utils/http` 中的访问基础设施逐步迁入 `api/shared`

### 9. `config`、`router`、`directives`、`assets`、`locales`

规则：

- `config/` 迁到 `app/config`
- `router/` 迁到 `app/router`
- 全局 directives 迁到 `app/directives`
- 静态资源迁到 `shared/assets`
- 国际化资源迁到 `shared/locales`

### 10. 清理空目录与弱语义目录

建议清理：

- 空目录 `views/about`
- 空目录 `directives/core`
- 空目录 `utils/workspace`

同时约束：

- 不再新增以 `core`、`common`、`business` 为主边界的目录

## 重点治理对象

### 1. tasks

这是当前最值得优先治理的 feature。

建议：

- 将 `components/tasks/*` 收口到 `features/tasks/*`
- `detail/cli` 继续保留按 agent provider 分目录
- 共享代码只允许放在 `features/tasks/detail/cli/shared`
- 共享内容限于非 UI、语义稳定的 parser、grouping、types、pure helpers

重要约束：

- 保持现有 CLI renderer ownership 规则不变
- 不建立新的共享 UI renderer 目录
- 迁移路径时同步迁移对应 dev spec

### 2. business-lines

当前业务线相关能力散在：

- 页面目录
- `components/business/settings`
- 部分页内组件

建议：

- 统一收口到 `features/business-lines`
- 业务线管理面板拆成更小的容器和子面板
- 合并重复实现，尤其是重复的表单弹窗

### 3. skills 与 mcp

当前这两个域依赖了 `components/business/settings` 中的 modal。

建议：

- `SkillUploadModal` 收口到 `features/skills`
- `McpJsonImportModal` 收口到 `features/mcp`
- 页面层只负责组合与调用

### 4. layout 与 notifications

这两个 feature 当前被拆散在：

- `hooks/core`
- `keys`
- `workers`
- `components/core/layouts`

建议：

- `layout` 统一收口到 `features/layout`
- `notifications` 统一收口到 `features/notifications`
- 结构性 layout 壳组件只保留在 `app/layouts`

## 量化指标改为“评审触发线”，不是硬性封顶

这些数值不是 CI 的统一硬阈值，而是 review 与 AI coding 的触发线。

### 文件级触发线

| 对象 | 建议值 | 触发动作 |
|------|--------|---------|
| 页面 SFC | 超过 400 行 | 评估拆成“页面壳 + feature 组合” |
| feature 组件 | 超过 300 行 | 评估拆 UI 区块或抽 composable |
| composable / store | 超过 250 行 | 检查是否混入多个职责或隐藏副作用 |
| `index.ts` 公开入口 | 超过 50 行 | 检查是否暴露过多内部结构 |

### 目录级触发线

| 对象 | 建议值 | 触发动作 |
|------|--------|---------|
| 单目录文件数 | 超过 20 个 | 评估按子域建子目录 |
| 相对 import 深度 | 超过 4 层 | 优先改用 alias 或重构边界 |
| 一般目录嵌套深度 | 超过 5 层 | 评估是否过度拆分 |

批准的例外：

- `features/tasks/detail/cli/<provider>` 的目录深度是明确接受的例外
- 原因是 agent renderer ownership 比浅层目录更重要

## AI 友好的落点规则

新增文件时，统一按以下顺序判断：

1. 这是应用启动、全局注册、路由装配、全局壳层吗？
   - 是：放 `app`
2. 这是路由页面入口吗？
   - 是：放 `pages`
3. 这是某个业务域专属能力吗？
   - 是：放对应 `features/*`
4. 这是后端请求或访问基础设施吗？
   - 是：放 `api`
5. 这是跨多个 feature 复用、无业务语义、且已经稳定了吗？
   - 是：放 `shared`
6. 如果仍然拿不准：
   - 默认先放 `features/*`

这个默认策略的核心目的，是让 AI 在不确定时犯“局部化”的错误，而不是犯“过早共享”的错误。

## 迁移策略

### Phase 0：兼容期准备

目标：

- 为后续迁移建立稳定入口，而不是先大规模移动文件

必须完成：

- 在 `tsconfig.json` 和 `vite.config.ts` 中增加新别名，例如 `@app/`、`@pages/`、`@features/`、`@api/`、`@shared/`
- 在 `AGENTS.md` 和 `docs/dev-spec/` 中声明迁移中的 source of truth
- 明确“已废弃但仍存在”的目录清单
- 对新迁移切片，停止向旧路径新增文件

注意：

- TypeScript 工具文件可以短期使用薄 re-export shim
- Vue SFC 不建议长期依赖兼容壳文件
- 路由 URL、菜单文案、后端接口边界不是这一个 Phase 的改造目标

### Phase 1：建立新骨架与全局基础层

目标：

- 先把 `app`、`shared`、`api/shared` 的基础边界搭起来

建议迁移：

- `router -> app/router`
- `config -> app/config`
- 全局 `directives -> app/directives`
- `components/ui -> shared/ui`
- `assets -> shared/assets`
- `locales -> shared/locales`
- `lib -> shared/lib`
- `utils/http -> api/shared`
- 清理空目录

### Phase 2：修正通用边界

目标：

- 停止顶层技术碎片继续扩张

建议迁移：

- `hooks -> composables`
- `keys -> *.context.ts`
- `workers -> feature-owned workers`
- `components/core/layouts -> app/layouts + features/layout`
- `views -> pages`

要求：

- 文件移动和 import 修改在同一个 PR 内完成
- 同步补测试和修别名

### Phase 3：按业务域收口

目标：

- 让业务实现尽量在 feature 内闭合

建议顺序：

1. `layout`、`notifications`
2. `tasks`
3. `business-lines`
4. `skills`
5. `mcp`
6. `workflow`、`settings`、`access`

切片迁移要求：

- 每迁一个 feature slice，同步补齐它的公开入口
- 在同一个 PR 中完成目录移动、import 修正和旧路径禁用
- 不接受“目录已经迁走，但外部还在 deep import 旧内部路径”的过渡状态

### Phase 4：拆大文件并启用严格守护

目标：

- 处理当前已经明显过大的页面、面板和 composable
- 让新结构真正被工具守住

建议动作：

- 拆业务线大面板
- 拆任务详情大页面
- 拆大 composable / store
- 启用更严格的依赖规则与旧路径禁用规则
- 删除已完全迁移切片的旧目录

### 每个 Phase 完成后的必做动作

1. 更新 `AGENTS.md` 和相关 `docs/dev-spec/`
2. 更新 alias 和 lint allowlist / denylist
3. 为已迁移切片禁止新文件落入旧路径
4. 跑通 type-check、lint 和对应测试

## 架构守护工具

纯靠文档约束在 AI coding 场景下是不够的，必须有工具守护。

### 推荐守护组合

1. ESLint Flat Config 中增加边界规则
2. CI 增加循环依赖检查
3. 对已迁移切片启用旧路径禁用规则

可选工具：

- `eslint-plugin-boundaries`
- `eslint-plugin-import` 或等价的 restricted imports 方案
- `dependency-cruiser` 或 `madge`

### 建议守护规则

```text
rules:
  - shared/** 只能依赖 shared/** 与 npm 包
  - api/** 不允许依赖 app/**、pages/**、features/**
  - pages/** 不允许依赖其他 pages/**
  - pages/** 只能通过公开入口依赖 features/**
  - features/** 不允许 deep import 其他 features/**
  - features/** 之间不允许形成双向循环依赖
  - 已迁移切片不允许再 import 对应旧路径
```

补充说明：

- “禁止 feature 互相 import”不是最终规则
- 最终规则是“禁止 deep import 与双向依赖，只允许通过公开入口形成单向依赖”
- 对 `pages -> features` 和 `features -> features` 的公开入口限制，应优先按“已迁移切片”启用，而不是在迁移初期对全仓库一次性强推

### 启用节奏

- Phase 0：先加 alias 和最基础的路径规则
- Phase 1：启用 `shared` / `api` 的层间约束
- Phase 2：对已迁移切片启用 `pages` 与 `features` 的公开入口约束
- Phase 3：按切片启用旧路径禁用规则
- Phase 4：启用循环依赖检查和全量边界规则

## 验收标准

如果满足以下条件，可以认为结构已经明显更 AI 友好：

- 新需求通常能先定位到单个 `features/*` 或单个 feature slice
- 页面文件主要承担编排职责，而不是沉淀长期业务实现
- 顶层不再继续新增 `hooks`、`keys`、`workers`、`enums` 这类技术碎片目录
- `shared` 不再被业务代码持续污染
- 跨 feature 引用只通过公开入口发生，不再出现 deep import
- feature 间不存在双向依赖
- 状态归属符合本方案的状态矩阵，而不是把 store 当事件总线
- `AGENTS.md`、`docs/dev-spec/`、lint 规则与实际目录保持同步
- 对已迁移切片，CI 能阻止向旧路径新增文件
- `tasks/detail/cli` 在迁移后仍然保持现有 renderer ownership 约束

## 不在本次目标内的事项

本次优化不追求：

- 一次性完成全量目录重写
- 为了术语整齐而强行统一所有前后端命名
- 为了“看起来像架构”而机械切碎每个 feature
- 一次性迁完所有 API client 与 Pinia store
- 在没有迁移切片完成前，就全量启用所有禁用规则
- 单纯为了目录迁移而改动路由 URL、产品术语或后端模块边界

## 总结

这份方案的核心不是把目录改得更“高级”，而是把前端结构改得更低歧义、更容易落点、更容易守住。

对于当前项目，更合适的方向是：

- `app` 负责装配
- `pages` 负责入口与编排
- `features` 负责业务能力
- `api` 负责后端访问
- `shared` 负责稳定共享

同时补上三件过去不够明确的事情：

- 允许 feature 间通过公开入口形成单向依赖
- 为状态与副作用定义清晰归属
- 用兼容迁移和 lint 守护替代大爆炸式重构

这套结构既更适合 AI 编码，也更适合团队长期维护和 review。
