# 使用 diting 开发多项目时的 workspace 管理方案

## 背景

这里讨论的不是 `diting` 产品仓本身，而是使用 `diting` 执行开发任务时，被 `diting` 拉取、创建、修复、测试或生成变更的各个目标项目仓库。

典型结构可能类似：

```text
diting-workspace/
  project-a/        # 目标项目仓库
  project-b/        # 目标项目仓库
  project-c/        # 目标项目仓库
  prompts/
  scripts/
  reports/
  workspace.yaml
```

如果这些目标项目各自都是独立 Git 仓库，workspace 根目录就会遇到一个问题：

- 每个子仓库只能由自己的 `.git` 追踪；
- workspace 根目录无法直接管理子仓库内部源码；
- workspace 根目录下的任务说明、运行脚本、仓库清单、调试报告、生成物索引等“非项目仓内容”容易无人管理；
- 如果强行把所有内容放进一个 Git 仓库，又容易破坏目标项目原本的仓库边界；
- 如果把运行态内容纳入 Git，容易误提交 `.env`、日志、数据库、临时 worktree、Agent 缓存等敏感或噪声文件。

因此需要先区分两类内容：

- **目标项目源码**：仍应由各自项目仓库管理。
- **workspace 编排资产**：仓库清单、统一脚本、任务模板、运行说明、评测规则、交付报告索引等，可以由 workspace 层单独管理。
- **本地运行态与敏感内容**：只属于当前机器或当前执行环境，应该继续忽略或放入专门的配置/密钥系统。

## 方案一：外层 umbrella 仓库管理 workspace 元信息

做法：在目标项目的共同父目录创建一个 Git 仓库，只管理 workspace 层内容，不直接追踪各目标项目源码。

示例结构：

```text
diting-workspace/
  .git/
  README.md
  workspace.yaml
  scripts/
  prompts/
  reports/
  project-a/        # 独立 Git 仓库
  project-b/        # 独立 Git 仓库
```

适合内容：

- workspace 的 `README.md`、使用说明、目录约定；
- `workspace.yaml` / `repos.json` 这类目标项目清单；
- 批量 clone、sync、status、clean、backup 脚本；
- `diting` 任务模板、统一提示词、评测规则；
- 任务报告索引、交付记录、非敏感的执行摘要。

优点：

- 最贴近“管理 workspace 其他内容”的诉求；
- 不改变目标项目原本 Git 历史；
- 可以统一沉淀 `diting` 使用方式、脚本和任务资料；
- 目标项目仍按各自仓库独立提交、推送、开 MR。

缺点：

- 外层仓库不能直接追踪子仓库内部源码；
- 外层提交和目标项目提交是两套流程；
- 需要明确哪些目录属于 workspace 资产，哪些目录属于目标项目；
- 多人协作时，同事 A 改功能 a、同事 B 改功能 b，如果都修改 `workspace.yaml`、共享脚本、提示词或报告索引，外层仓库仍会产生普通文本冲突；即使外层仓库合并成功，也不代表各目标项目里的功能分支已经合并完成。

推荐程度：**优先推荐**。如果你的问题是“多个项目仓库之外的 workspace 内容没人管”，这是最合适的默认方案。

## 方案二：manifest 清单管理目标项目列表

做法：workspace 仓库只保存一个清单文件，描述每个目标项目的仓库地址、默认分支、本地路径、用途和可选 commit，然后用脚本统一操作。

示例：

```yaml
repos:
  - name: project-a
    url: git@gitlab.example.com:team/project-a.git
    path: project-a
    branch: main
    role: backend service
  - name: project-b
    url: git@gitlab.example.com:team/project-b.git
    path: project-b
    branch: develop
    role: web console
```

适合内容：

- `diting` 经常要操作多个目标项目；
- 需要批量 clone、拉取、查看状态、检查分支；
- 希望记录“这个 workspace 应该包含哪些项目”，但不想用 submodule。

优点：

- 对多仓规模更友好；
- 清单可读、可审查、可扩展；
- 不改变各目标项目仓库模型；
- 后续可让 `diting` 根据清单选择目标仓库、生成任务上下文或执行批量检查。

缺点：

- 需要维护脚本或工具；
- Git 本身不会根据 manifest 自动同步仓库；
- 清单里的分支、路径、用途需要团队持续维护；
- 多人同时新增项目、调整同一项目分支或修改同一段仓库配置时，`workspace.yaml` 容易冲突；更隐蔽的问题是 A/B 的目标项目分支各自变化，但清单只记录一个默认分支或 commit，合并时可能覆盖对方的 workspace 预期。

推荐程度：**推荐**。如果 `diting` 的目标项目会越来越多，建议在 umbrella 仓库里加入 `workspace.yaml`。

## 方案三：Git submodule 锁定目标项目版本

做法：workspace 仓库使用 Git submodule 引用目标项目，只记录每个目标项目的远程地址和具体 commit。

适合内容：

- 一次 `diting` 开发任务涉及多个目标项目，且需要复现当时的精确版本；
- workspace 需要记录“project-a 在 commit X，project-b 在 commit Y”；
- 目标项目必须保持独立仓库、独立权限和独立 CI。

优点：

- 可以精确复现多仓组合；
- 目标项目独立性强；
- 适合交付、回归、审计或版本冻结场景。

缺点：

- 日常操作成本高；
- 新人容易忘记 `git submodule update --init --recursive`；
- 外层提交和子仓提交是两步，容易漏提 submodule 指针；
- 对 Agent 自动化也更复杂，需要明确何时更新指针、何时提交子仓变更；
- 多人协作时，如果同事 A 和 B 都更新同一个 submodule 指针到不同 commit，外层合并会出现指针冲突；即使没有文本冲突，也可能出现“外层指针选了 A 的 commit，但目标项目里 B 的功能还没合并”的情况。

常用命令：

```bash
git submodule add <repo-url> path/to/repo
git submodule update --init --recursive
git submodule update --remote path/to/repo
```

推荐程度：仅在“必须锁定多仓精确版本”时使用。如果只是管理 workspace 元信息，submodule 偏重。

## 方案四：git-subrepo 折中管理目标项目内容

做法：使用 `git-subrepo` 把目标项目拉入 workspace 仓库的子目录。目标项目内容会像普通文件一样出现在 workspace 仓库中，同时通过 `.gitrepo` 元数据记录上游仓库、分支和同步状态。

适合内容：

- 希望 workspace 仓库能直接看到并追踪某个目标项目目录；
- 不想使用 submodule 的嵌套仓库和指针管理模式；
- 仍希望保留向上游目标项目 pull / push 的同步能力；
- 目标项目数量不多，且同步关系需要人工或脚本明确控制。

优点：

- clone workspace 后内容完整，不需要额外初始化子模块；
- 没有嵌套 `.git`，普通 Git 工具更容易查看和搜索；
- 比 subtree 多了 `.gitrepo` 元数据，同步来源更清楚；
- 比 submodule 更像普通目录，对 Agent 读写文件更直接。

缺点：

- 需要团队额外安装并理解 `git-subrepo`；
- 仍会把目标项目内容纳入 workspace 仓库历史，仓库可能变大；
- 与上游双向同步仍需谨慎，冲突处理成本不可忽略；
- 目标项目如果本来应独立评审、独立发布，边界会变弱；
- 多人协作时，A/B 如果都在 workspace 内修改同一个 subrepo 目录，合并会像普通 monorepo 一样产生源码冲突，同时还可能冲突 `.gitrepo` 元数据；后续 `git subrepo push` 到上游时，还要再次面对目标项目远端分支的合并顺序和冲突。

常用命令：

```bash
git subrepo clone <repo-url> path/to/repo
git subrepo pull path/to/repo
git subrepo push path/to/repo
```

推荐程度：适合“想避免 submodule，但又希望比 subtree 更明确记录上游关系”的折中场景。对 `diting` 多项目开发来说，不建议作为默认模型，更适合少量强相关项目或可复用资产。

## 方案五：Git subtree 把目标项目并入 workspace 仓库

做法：把目标项目内容导入 workspace 仓库的某个子目录，由 workspace 仓库直接追踪导入后的文件，并保留与上游同步能力。

适合内容：

- 某个目标项目已经不需要强独立仓库边界；
- 想让 workspace 仓库直接审查和追踪它的源码；
- 与上游同步频率较低。

优点：

- clone workspace 后内容完整；
- 普通 Git 用户使用成本低；
- workspace 仓库可以直接追踪导入目录内的文件。

缺点：

- 历史会变复杂，仓库体积可能增大；
- 与上游双向同步需要谨慎；
- 不适合大量目标项目；
- 容易模糊“目标项目独立交付”与“workspace 编排”的边界；
- 多人协作时，A/B 修改同一个导入目录会直接在 workspace 仓库产生源码冲突；如果其中一方还做了 subtree pull，同步上游带来的历史和代码变更会与功能开发混在一起，合并审查成本更高。

常用命令：

```bash
git subtree add --prefix=vendor/example <repo-url> main --squash
git subtree pull --prefix=vendor/example <repo-url> main --squash
git subtree push --prefix=vendor/example <repo-url> main
```

推荐程度：一般不推荐作为 `diting` 多项目开发的默认模型。只有目标项目确实要并入 workspace 统一管理时再考虑。

## 方案六：目标项目仍独立，workspace 只保存任务记录

做法：不尝试在 workspace 层管理目标项目列表，只把每次 `diting` 执行任务产生的非敏感记录保存下来。

适合内容：

- 每个 `diting` 任务只针对单个目标项目；
- 多项目之间没有固定组合关系；
- 只关心任务说明、结果摘要、MR 链接、验收记录。

优点：

- 最轻量；
- 不影响目标项目仓库；
- 适合 `diting` 作为“任务执行器”，而不是“多仓版本编排器”的场景。

缺点：

- 不能复现完整多仓 workspace；
- 不能批量管理目标项目；
- 后续项目数量增多后容易缺少统一入口；
- 多人协作时，A/B 的任务记录可能使用相同报告路径、任务编号或摘要文件而冲突；更重要的是，任务记录合并只代表记录合并，不代表目标项目里的功能 a 和功能 b 已经按正确顺序合并。

推荐程度：适合早期或单仓任务为主的阶段。后续可平滑升级到 umbrella + manifest。

## 方案七：独立资料仓库管理跨项目知识

做法：创建一个专门的资料仓库，例如 `diting-workspace-notes`、`ai-dev-workspace` 或 `engineering-automation`，只管理跨项目知识、脚本和约定。

适合内容：

- 不属于任何目标项目，但需要长期维护的资料；
- 多项目共享的开发手册、Agent 使用规范、排障指南；
- 不希望放进任一业务项目仓库的辅助内容。

优点：

- 权限和历史独立；
- 不影响业务仓库体积；
- 资料与代码边界清楚。

缺点：

- 文档和代码可能脱节；
- 需要维护链接和引用；
- 跨仓变更需要多个 MR 或提交；
- 多人协作时，A/B 可能同时修改同一份规范、脚本或项目说明，资料仓库会产生文本冲突；如果资料 MR 先合并、目标项目 MR 后合并或失败，文档会短时间领先于实际代码状态。

推荐程度：适合跨项目知识管理。如果这些资料主要服务某一个本地 workspace，则 umbrella 仓库更直接。

## 不建议的做法

### 不建议让两个 Git 仓库同时追踪同一批源码

同一目录同时被外层仓库和内层仓库追踪，会造成状态混乱、提交归属不清、忽略规则冲突。Git 对嵌套仓库的默认处理也不是“外层继续递归追踪所有文件”。

对于使用 `diting` 开发的目标项目，应该明确：

- 目标项目源码归目标项目仓库管理；
- workspace 编排资产归 workspace 仓库管理；
- `diting` 自身源码归 `diting` 产品仓管理。

### 不建议把本地运行态内容纳入版本控制

workspace 层通常应该忽略：

- `.env`、`.env.local`
- `.diting/`、`.cache/`
- `logs/`、`tmp/`
- `worktrees/`、`.worktrees/`、临时 clone 目录
- `node_modules/`、`dist/`、`coverage/`
- 数据库文件、录屏、完整执行日志、包含 token 的报告

这些内容通常包含本地路径、密钥、账号、数据库、日志或可再生成产物，不应该为了“workspace 可管理”而提交。

### 不建议用压缩包或手动备份替代 Git

压缩包适合归档，不适合协作、审查、回滚和差异查看。需要长期维护的 workspace 资产应该进入某个明确的 Git 仓库。

## 面向 diting 使用场景的推荐路径

建议按以下顺序处理：

1. **为使用 `diting` 的目标项目集合建立一个外层 workspace 仓库。**
   它只管理 workspace 说明、仓库清单、脚本、任务模板、非敏感报告索引。

2. **让各目标项目继续保持独立 Git 仓库。**
   `diting` 生成的代码变更应该提交到目标项目自己的仓库，而不是提交到 workspace 外层仓库。

3. **用 `workspace.yaml` 记录目标项目清单。**
   至少记录 `name`、`url`、`path`、`branch`、`role`。后续可以扩展 `owner`、`testCommand`、`qualityGate`、`ditingProfile`。

4. **把运行态内容和敏感内容排除在 workspace 仓库之外。**
   `.env`、日志、数据库、临时 worktree、完整 Agent 执行缓存都不应提交。

5. **只有需要精确复现多仓组合版本时，才升级到 submodule。**
   如果只是知道有哪些项目，用 manifest 比 submodule 更轻；如果要把少量目标项目内容纳入 workspace 仓库，再评估 `git-subrepo` 或 subtree。

## 方案对比表

| 方案 | 管理对象 | 是否管理目标项目源码 | 适用场景 | 优点 | 缺点 | 复杂度 | 推荐程度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 外层 umbrella 仓库 | workspace 说明、仓库清单、脚本、提示词、非敏感报告 | 否，目标项目源码仍由各自仓库管理 | 想管理多个目标项目之外的 workspace 内容 | 边界清晰；不改变目标项目历史；最贴合 `diting` 多项目工作区 | 外层仓库不能追踪子仓内部源码；提交流程分两层；多人同时改清单、脚本或报告索引会冲突，外层合并也不代表目标项目功能已合并 | 低 | **默认推荐** |
| `workspace.yaml` manifest | 目标项目列表、路径、分支、用途、可选质量命令 | 否，只描述项目元信息 | 需要让 `diting` 或脚本知道 workspace 包含哪些项目 | 轻量、可审查、便于自动化；后续可扩展 owner、testCommand、qualityGate | 需要维护清单和同步脚本；Git 不会自动 clone / pull；多人同时改同一项目配置时易冲突，合并可能覆盖对方的分支或 commit 预期 | 低到中 | **推荐与 umbrella 搭配使用** |
| manifest + 脚本 | 多项目批量 clone、pull、status、clean、检查分支 | 否，通过脚本操作各项目自己的 Git | 目标项目数量较多，需要批量管理 | 不改变项目仓库模型；自动化能力强；适合 `diting` 选择目标仓库 | 需要维护脚本；脚本失败处理和跨平台兼容要设计；多人改脚本或清单会冲突，脚本合并后还要确认各目标仓分支状态一致 | 中 | 推荐 |
| Git submodule | 每个目标项目的远程地址和精确 commit 指针 | 不直接管理源码内容，只管理子仓指针 | 需要复现多仓精确版本组合，或交付时冻结多项目状态 | 可精确锁定版本；适合审计、回归、版本冻结 | 日常操作复杂；容易漏更新指针；多人更新同一 submodule 到不同 commit 会产生指针冲突，或外层指针合并后遗漏某个功能分支 | 中到高 | 有版本锁定需求时使用 |
| git-subrepo | 被拉入的目标项目源码和 `.gitrepo` 上游元数据 | 是，内容由 workspace 仓库追踪，同时保留同步来源 | 想避免 submodule，但仍要记录上游并支持 pull / push | clone 后内容完整；没有嵌套 `.git`；比 subtree 的上游关系更显式 | 需安装额外工具；会增加 workspace 仓库历史；多人改同一 subrepo 目录会产生源码和 `.gitrepo` 冲突，push 上游时还可能再次冲突 | 中到高 | 少量强相关项目可考虑 |
| Git subtree | 被导入的目标项目源码 | 是，导入后由 workspace 仓库直接追踪 | 少量目标项目要并入 workspace 统一评审或低频同步 | clone 后内容完整；普通 Git 使用成本低 | 历史变重；同步复杂；多人改同一导入目录会直接产生源码冲突，subtree pull 的上游变更还会与功能开发混在一起 | 中到高 | 谨慎使用 |
| 只保存任务记录 | 任务说明、结果摘要、MR 链接、验收记录 | 否 | `diting` 主要执行单项目任务，不需要管理项目集合 | 最轻量；不影响目标项目；容易落地 | 不能复现完整多仓 workspace；后续项目多了缺少统一入口；多人报告路径或任务编号重复会冲突，记录合并不代表目标功能合并 | 低 | 早期可用 |
| 独立资料仓库 | 跨项目知识、开发手册、Agent 使用规范、排障指南 | 否 | 资料不绑定某个本地 workspace，也不属于具体目标项目 | 权限和历史独立；不污染业务仓；适合知识沉淀 | 文档和代码可能脱节；跨仓引用需要维护；多人同时改规范或脚本会冲突，资料合并可能领先于实际代码合并 | 低到中 | 适合跨项目知识管理 |

如果只选一个起步方案，建议选择“外层 umbrella 仓库 + `workspace.yaml` manifest”：外层仓库管理 workspace 资产，`workspace.yaml` 记录目标项目清单，各目标项目仍保持独立 Git 流程。这样能先解决“其他内容无人管理”的问题，又不会把多仓模型复杂化。

## 最小落地建议

如果当前主要诉求是“使用 `diting` 开发的各个项目之外，还有一些 workspace 内容想被 Git 管理”，可以先做最小方案：

1. 在目标项目共同父目录执行 `git init`，建立外层 workspace 仓库；
2. 新增 `README.md`，说明这个 workspace 用于配合 `diting` 管理多个目标项目；
3. 新增 `workspace.yaml`，记录目标项目仓库地址、本地路径和默认分支；
4. 新增 `.gitignore`，忽略各目标项目目录、`.env`、日志、数据库、临时 worktree 和 Agent 缓存；
5. 只提交 `README.md`、`workspace.yaml`、`scripts/`、`prompts/`、非敏感 `reports/`；
6. 目标项目源码变更仍在各自项目仓库中提交；
7. 当确实需要复现多仓版本组合时，再考虑 submodule；当确实需要把少量目标项目内容纳入外层仓库时，再考虑 `git-subrepo` 或 subtree。

一个外层 `.gitignore` 示例：

```gitignore
# target repositories
project-a/
project-b/
project-c/

# local runtime
.env
.env.local
.diting/
.cache/
logs/
tmp/
worktrees/
.worktrees/

# generated dependencies and build outputs
node_modules/
dist/
coverage/
```

这样可以先解决 workspace 级资料无人管理的问题，同时保持 `diting`、workspace、目标项目三者的 Git 边界清晰。

## `feature/git_management_v1` 与 `feature/git_management_v2` 对比报告

### 总体定位

从分支内容看，`feature/git_management_v1` 更偏向 **保守的多仓 workspace 管理方案**：目标项目继续保持各自独立 Git 仓库，workspace 层主要通过 umbrella 仓库、`workspace.yaml` manifest、脚本和任务记录来管理编排资产。

`feature/git_management_v2` 更偏向 **大仓 + `git-subrepo` 的统一工作区方案**：目标项目源码以普通目录形式进入 workspace 大仓，由 `.gitrepo` 记录上游关系，`diting` 通过 `workspace.yaml` 自动识别 subrepo 大仓模式，并围绕子仓选择、基线校验、分支约束和 MR 创建形成更完整的自动化链路。

### 核心差异

| 维度 | `feature/git_management_v1` | `feature/git_management_v2` |
| --- | --- | --- |
| 管理模型 | 外层 umbrella 仓库 + manifest + 独立目标仓 | workspace 大仓 + `git-subrepo` 子仓目录 |
| 目标项目源码 | 不进入 workspace 外层仓库，由各自仓库管理 | 进入 workspace 大仓，由大仓直接追踪文件内容 |
| workspace 清单 | 主要描述目标项目列表、路径、分支、用途 | 以 `subrepos` 描述子仓、远端仓库和 test/stage/production 分支 |
| `diting` 运行方式 | 更接近单仓或多独立仓 worktree 模式 | 拉取任务目标仓后自动探测 `workspace.yaml`，识别大仓 subrepo 模式 |
| 自动化重点 | 批量 clone、sync、status、任务记录等轻量编排 | 子仓选择、基线检查、feature 分支约束、subrepo push/MR 流程 |
| 协作边界 | 目标项目 Git 边界最清晰，但跨仓变更分散 | 一个 workspace 内可直接看见多项目变更，但需维护同步纪律 |
| 落地成本 | 低，团队只需维护清单和脚本 | 中到高，团队需要安装并理解 `git-subrepo` 与统一 Makefile 流程 |

### `feature/git_management_v1` 的优点

- **仓库边界清晰**：目标项目仍完全归各自 Git 仓库管理，workspace 只管理说明、清单、脚本、提示词和非敏感报告，职责容易解释。
- **落地成本低**：不要求团队引入 `git-subrepo`、submodule 或 subtree，只需要一个外层 Git 仓库和可读的 manifest。
- **风险更可控**：不会把目标项目源码合入 workspace 历史，仓库体积、权限边界、CI 发布边界都更接近现状。
- **适合渐进演进**：早期可以先解决“workspace 资产无人管理”的问题，后续再按需要升级到 submodule、`git-subrepo` 或其他模型。
- **对既有项目侵入小**：目标仓不需要调整目录结构或工作流，`diting` 对目标项目的提交、推送、MR 仍按原项目流程处理。

### `feature/git_management_v1` 的缺点

- **跨项目上下文不完整**：workspace 外层仓库不能直接追踪目标项目源码，Agent 需要分别进入各仓库处理 Git 状态和变更。
- **多仓变更分散**：一个需求涉及多个项目时，提交、推送、MR 和 CI 分布在多个目标仓，整体变更关系需要额外记录。
- **manifest 只描述意图**：`workspace.yaml` 能说明“应该有哪些项目”，但 Git 不会自动保证这些项目已 clone、已同步或分支正确。
- **复现能力有限**：除非额外记录 commit，否则很难精确复现某次任务所依赖的多仓组合版本。
- **自动化上限较低**：适合轻量编排，但要做到统一基线校验、跨项目变更审查和批量 MR，仍需要继续扩展工具链。

### `feature/git_management_v2` 的优点

- **多项目上下文完整**：子仓源码在 workspace 大仓中表现为普通目录，`diting` 和开发者可以在一个工作区直接检索、修改和审查多项目变更。
- **自动识别大仓模式**：环境插件会在任务 workspace 中探测 `Workspace.yaml` / `workspace.yaml`，存在 manifest 时按 `git-subrepo` 模式处理，减少对固定 `.env` 路径的依赖。
- **子仓选择更精确**：可根据任务中的 repo key、目录名、仓库 URL 或 slug 匹配 `subrepos`，避免每次都无差别处理全部项目。
- **流程约束更强**：实现层要求 subrepo 任务使用 `feature/` 分支，并校验 workspace 根目录、子仓目录、分支和准备结果，更利于自动化安全落地。
- **MR 与 CI 边界仍可保留**：大仓用于承载跨项目整体变更，子仓仍可通过 `git subrepo push` 或封装命令推送到各自 feature 分支并创建 MR。
- **文档与实现更一致**：分支同步补充了 manifest、environment、pull request、plugin API 和测试，说明方案已从架构讨论推进到可运行实现。

### `feature/git_management_v2` 的缺点

- **工具链门槛更高**：团队必须安装并理解 `git-subrepo`，还要遵循 Makefile 封装命令，不能随意进入子仓目录按独立仓习惯操作。
- **仓库历史会变重**：目标项目内容进入 workspace 大仓历史后，仓库体积、clone 成本和审查范围都会增加。
- **同步冲突更复杂**：同一个子仓目录既可能产生普通源码冲突，也可能产生 `.gitrepo` 元数据或上游同步冲突，push 回子仓远端时还可能再次冲突。
- **权限和边界更敏感**：如果不同目标项目原本权限、发布节奏或保密级别不同，把源码纳入同一个大仓需要提前确认权限模型。
- **流程失败的恢复成本更高**：subrepo push、MR 创建、生产基线合并等环节一旦失败，需要团队理解大仓与子仓的双层状态才能排障。
- **不适合大量低相关项目**：项目数量很多、关联度低或只是偶发被 `diting` 操作时，大仓 + 子仓源码的模式可能过重。

### 适用场景判断

`feature/git_management_v1` 更适合以下场景：

- 目标项目已经有成熟且独立的 Git / CI / MR 流程；
- 当前主要痛点是 workspace 文档、清单、脚本、任务记录无人管理；
- 多项目联动不频繁，或者跨项目需求可以接受多个独立 MR 管理；
- 团队希望先低成本落地，不希望引入新的 Git 扩展工具；
- 目标项目之间权限边界明显，不适合把源码放入同一个大仓。

`feature/git_management_v2` 更适合以下场景：

- `diting` 需要长期在同一个 workspace 内处理多个强相关项目；
- 跨项目需求频繁，需要一个统一视角审查整体变更；
- 团队愿意用 Makefile 固化 `git-subrepo` 操作，并能接受新的协作纪律；
- 希望 Agent 在一个完整工作区内直接搜索、修改、测试多个项目；
- 仍希望子仓保留自己的远端仓库、feature 分支、MR 和 CI，而不是完全并入普通 monorepo。

### 推荐结论

如果目标是 **先稳妥解决 workspace 资产管理问题**，建议优先采用 `feature/git_management_v1` 的思路：外层 umbrella 仓库管理 `workspace.yaml`、脚本、提示词、报告和规范，目标项目继续保持独立 Git 流程。这条路径成本低、边界清晰，也方便后续演进。

如果目标是 **让 `diting` 获得完整多项目上下文，并把跨项目开发流程产品化**，`feature/git_management_v2` 更有价值。它把 manifest 探测、subrepo 选择、分支约束、workspace artifact 和 MR 流程都纳入实现，是更接近可规模化自动化的方案。

综合看，两者不是完全互斥关系。更稳妥的路线是：

1. 以 `v1` 作为默认轻量模型，覆盖普通多仓 workspace；
2. 将 `v2` 作为强相关多项目或业务大仓场景的增强模型；
3. 在配置和文档中明确两种模式的触发条件：没有 `workspace.yaml` 或仅有普通 manifest 时走独立仓 worktree；检测到包含 `subrepos` 的 manifest 时走 `git-subrepo` 大仓模式；
4. 对 `v2` 补齐排障指南、失败恢复流程和权限边界说明，避免团队只看到自动化收益而低估同步成本。

