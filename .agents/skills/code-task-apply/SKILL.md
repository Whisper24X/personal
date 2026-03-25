---
name: code-task-apply
description: 执行 OpenSpec apply 命令生成代码并完成任务。无状态执行工具，由 WriteCode Action 循环调用。触发场景：(1) 执行代码生成任务 (2) 实施 OpenSpec 规范 (3) 替换模板页面 (4) 完成 tasks.md 中的任务
---

# Code Task Apply Executor

执行 openspec-apply-change 技能，完成 `tasks.md` 中的所有任务。

## 输出规范（强制）

> **重要**：以下规范必须严格遵守，不可违反。

**文档路径**：输出路径**必须**从 prompt 获取（如 `docs/{{gitBranch}}/applyResult.md`）。

| 项目           | 规范                                        |
| -------------- | ------------------------------------------- |
| **执行技能**   | `openspec-apply-change`（自动执行，无需手动输入） |
| **任务来源**   | `openspec/changes/*/tasks.md`（必须存在）   |
| **任务标记**   | 完成后必须在 tasks.md 中标记为 `- [x]`      |
| **代码完整性** | 禁止 TODO/占位符/空实现/伪代码              |
| **构建验证**   | 必须执行 `make api`、`make wire` 等构建命令 |

## 🚨 关键原则

1. **"需要人工"标记限制**：只允许4种场景（手动测试、部署、第三方验证、人工审查）。其他所有任务必须实际执行，不允许因技术原因标记为"需要人工"
2. **代码必须完整**：禁止 TODO/占位符/空实现/伪代码，所有函数必须有完整实现
3. **必须可运行**：代码可编译、构建成功、依赖完整
4. **模板必须替换**：检查并替换初始模板页面（包含 unibest、AINative Workspace、虚构公司名等特征）

## 执行步骤

### 1. 代码实现

#### 1.1 环境检查（第一步，强制执行）

**检查 Sandbox 环境**：

1. 检查项目根目录是否有 `Makefile` 且包含 `sandbox` 目标
2. 检查 `sandbox/sandbox.sh` 脚本是否存在

**Sandbox 执行规则（强制）**：

| 条件           | 执行方式                              | 示例                                  |
| -------------- | ------------------------------------- | ------------------------------------- |
| **有 Sandbox** | 所有构建命令**必须**在 sandbox 内执行 | `make sandbox-shell` 然后 `make gorm` |
| **无 Sandbox** | 直接执行，失败则安装依赖后重试        | `make gorm`（如失败安装 gorm 工具）   |

**严格禁止**：

- ❌ 跳过 sandbox 检查
- ❌ 在 sandbox 外执行构建命令（当 sandbox 存在时）
- ❌ 报告"工具未安装"然后手动创建文件

#### 1.2 Skills 查询（优先复用）

查询项目中的所有可用 Skills，判断是否有专门的 Skill 可以完成当前任务。

**常见后端 Skills**：

- `backend-gorm`：生成 GORM 代码
- `backend-proto-gen`：生成 Proto 文件
- `backend-api-gen`：生成 API 代码
- `backend-database`：建表、菜单 SQL 注入（生成 `*_menu.sql` 后必须执行 `make sqlimport`）

优先使用专门 Skill，只有在没有合适 Skill 时才自己编写代码。

#### 1.3 模板替换（如有初始模板）

**检查位置**：`ainative-pc/src/views/`、`ainative-app/src/`、`ainative-mobile/src/`、`ainative-shadow/src/views/`

> 注意：模板内容不只出现在 `views/` 或 `pages/` 目录，也可能出现在根级文件（如 `src/App.vue`、`src/views/HomeView.vue`）。扫描时必须包含各端的根级文件，不能只扫子目录。

**初始模板特征**：欢迎使用YC-vue3模版、HelloWorld（组件名）、TheWelcome（组件名）、unibest、菲鸽、AINative Workspace、AINative PC、企业级 AI 原生协作、虚构公司名（天衡集团、星澜零售等）、通用演示描述

**替换要求**：

- 只替换包含初始模板特征的页面，不修改已有真实业务内容的页面
- **替换的定义**：删除文件中全部模板结构（模板组件引用、模板导航、演示内容等），用业务内容重写；**不是**在原有模板结构上追加内容或路由链接
- ❌ 严格禁止：文件内仍保留 `HelloWorld`、`TheWelcome` 等模板组件的 import 或使用，即使同时加入了业务内容也属于未完成替换
- 替换首页时判断是否需要添加功能入口：面向用户功能（计算器、任务管理等）需要添加入口，后台功能（API、数据模型等）不需要

**替换后验证（强制）**：模板替换完成后，必须对每个端执行关键词扫描，确认模板残留已清除：

```bash
# 示例：扫描 ainative-mobile 中的模板残留（HelloWorld、TheWelcome 等）
grep -rn 'HelloWorld\|TheWelcome\|欢迎使用YC-vue3模版\|AINative Workspace\|unibest\|菲鸽' ainative-mobile/src/ --include='*.vue' --include='*.ts' --include='*.js'
```

若扫描仍有命中，说明替换不完整，**必须继续清理直到零命中**。

#### 1.4 代码生成

根据 tasks.md 中的任务类型自行判断执行顺序，通常按依赖关系：数据层 → API层 → 业务层 → 前端层。

**代码生成工具命令执行规则表**：

| 命令类型          | 示例           | 有 Sandbox                | 无 Sandbox | 工具缺失处理         |
| ----------------- | -------------- | ------------------------- | ---------- | -------------------- |
| **GORM 生成**     | `make gorm`    | sandbox 内执行            | 直接执行   | 安装 gorm 工具后重试 |
| **Proto 生成**    | `make sqltopb` | sandbox 内执行            | 直接执行   | 安装 sqltopb 后重试  |
| **API 生成**      | `make api`     | sandbox 内执行            | 直接执行   | 检查 protoc 安装     |
| **依赖注入**      | `make wire`    | sandbox 内执行            | 直接执行   | 安装 wire 后重试     |
| **菜单 SQL 注入** | 见下方说明     | **必须在 sandbox 内执行** | -          | -                    |

**菜单 SQL 注入（强制）**：若任务涉及生成 `*_menu.sql`（如 `carousel_menu.sql`），在创建 SQL 文件后**必须在沙箱容器内**执行导入。数据库在沙箱内，宿主机执行 `make sqlimport` 无法连接到正确数据库。

```bash
# 从 sandbox/.env 读取 SANDBOX_NAME（容器名）和 PG_DB（SQL 目录名），再执行
# 示例：SANDBOX_NAME=yanxue-main-sandbox, PG_DB=yanxue → doc/sql/yanxue/{module}_menu.sql
docker exec $(grep -E '^SANDBOX_NAME=' sandbox/.env | cut -d= -f2-) bash -c "cd ainative-backend && make sqlimport ./doc/sql/$(grep -E '^PG_DB=' sandbox/.env | cut -d= -f2-)/{module}_menu.sql"
```

**菜单 SQL 注入后必须验证（强制）**：sqlimport 执行后，必须完成以下两步验证，不可跳过：

1. **验证数据入库**：在 sandbox 内查询 `sys_menu` 和 `sys_role_menu`，确认新增记录存在
2. **清理 Redis 菜单缓存**：后端对菜单权限数据有 Redis 缓存层，sqlimport 直接写 DB 不会自动失效缓存，必须主动删除相关 key：

```bash
# 查找并删除角色-菜单关联缓存（key 前缀以实际项目为准，可先 KEYS 确认）
# 格式通常为：{app-name}:DBCache:{db-name}:SysRoleMenuByRoleID:{roleId}
# 以及菜单详情缓存：{app-name}:DBCache:{db-name}:SysMenuByID:{menuId}
# 示例（从 sandbox/.env 读取 redis 连接信息）：
REDIS_ADDR=$(grep -E '^REDIS_ADDR=' sandbox/.env | cut -d= -f2-)
redis-cli -h ${REDIS_ADDR%:*} -p ${REDIS_ADDR#*:} -n <REDIS_DB> \
  DEL "$(redis-cli -h ${REDIS_ADDR%:*} -p ${REDIS_ADDR#*:} -n <REDIS_DB> KEYS '*SysRoleMenu*' | tr '\n' ' ')"
```

**严格禁止**：

- ❌ 标记"⚠️ 工具未安装，已手动创建"
- ❌ 标记"⚠️ 环境限制，已手动实现"
- ❌ 绕过代码生成命令，手动创建文件
- ❌ sqlimport 后不验证数据入库即标记完成
- ❌ sqlimport 后不清理菜单相关 Redis 缓存即标记完成

**代码标准**：完整实现（非空函数）、包含错误处理和参数验证、依赖正确引入可编译、禁止 TODO/占位符/空实现/伪代码

#### 1.5 前端 HTTP 请求前置检查（强制）

**凡涉及新增前端 HTTP 请求代码（API 文件、fetch/axios 调用）时，必须在动笔前完成以下三项检查，检查结果须体现在实现中：**

**① 对齐已有 API 文件风格（禁止自造封装）**

生成新 API 文件前，**必须先查找同目录或同类型的现有 API 文件**。若存在，则以已有文件的写法为基准，包括但不限于：`request` 的引入路径与调用方式、**接口路径前缀**、函数签名风格、传入选项参数、响应类型标注方式等。**新文件的写法必须与已有文件保持一致，不得在未参考的情况下凭直觉假设任何调用约定。**

> **参照来源限定**：参照对象必须是项目中**真实的业务 API 文件**（如 `sysMenu.ts`、`sysRole.ts` 等），不得以封装工具文件（`request.ts`、`http/index.ts` 等）的注释、JSDoc 示例或类型定义作为路径/调用方式的参照——工具文件里的示例可能仅为说明用途，不代表项目实际约定。

若项目中暂无同类 API 文件，按以下顺序查找参照：先看 `src/api/` 下是否有 `_conventions.md` 或 `README.md` 等约定文件；若无，再扫描 `src/`、项目根目录下的 `utils/`、`lib/` 等目录，结合构建配置中的路径别名，找到请求工具函数，理解其封装方式后照此实现。

**新写的 API 文件必须复用已有封装，不得引入项目中不存在的新 axios 实例或自造 HTTP 工具。**

② **确认环境变量真实存在**

凡代码中读取 `import.meta.env.VITE_XXX` 或 `process.env.XXX` 的变量，必须先检查项目所有 `.env`、`.env.development`、`.env.test`、`.env.production` 文件，确认该变量已定义。**未定义的变量不得直接使用**，应改用已存在的变量或写死合理默认值并注释说明。不得自行新增空值环境变量来绕过此检查。

③ **验证 API 路径可被 nginx 正确路由**

查看 `sandbox/nginx.conf`（或等价代理配置），**逐条列出所有 `location` 规则及其 `proxy_pass` 目标**，然后将新增接口路径与每条规则逐一对照，确认能匹配到正确的后端服务端口。

> ❌ 禁止凭直觉判断（如"路径里有 shadow 关键字就走 shadow 服务"），必须以 nginx 实际配置的前缀规则为准。例如：`/api/shadow/...` 和 `/shadow/...` 走的是不同的 `location`，若项目中其他 API 文件均用 `/shadow/...`，则新文件也必须用 `/shadow/...`，不得擅自加 `/api/` 前缀。

若路径无对应规则，需调整请求路径（以已有业务 API 文件的前缀为准），**不得新增 nginx location 规则来迁就错误的前端路径**。

若项目的 API 域名通过运行时配置注入（而非相对路径），则请求路径不经过 sandbox nginx，只需确认路径格式与后端路由注解一致即可。

### 2. 任务标记与验证

#### 2.1 任务标记规则

**三种状态**：

1. **未完成**：`- [ ] 任务名称` 或 `- [ ] 任务名称 📝 进度说明`
2. **完全完成**：`- [x] 任务名称 ✅ 已完整实现`（代码完整实现、无 TODO、构建成功）
3. **需要人工**：`- [x] 任务名称 ⚠️ 需要人工`（仅限4种场景：手动测试、部署、第三方验证、人工审查）

**严格禁止的标记**：

- ❌ `⚠️ 工具未安装，已手动创建`
- ❌ `⚠️ 环境限制，已手动实现`
- ❌ `⚠️ 因私有仓库访问权限问题无法执行`
- ❌ `⚠️ 项目未配置 lint 脚本`
- ❌ 仅创建 API 定义/接口就打勾
- ❌ 未完全完成就打勾

**正确处理方式**：

- **工具缺失**：在 sandbox 内或安装工具后执行，完成后标记 `✅ 已完成`
- **私有仓库问题**：尝试在 sandbox 内执行，如仍失败则标记 `📝 私有仓库访问问题，需配置凭证`（保持未完成状态）
- **Lint 脚本缺失**：执行基本代码检查（编译、语法检查、手动审查），标记 `✅ 已完成基本代码检查`

#### 2.2 代码质量检查

**后端检查**：

- 优先执行：`make lint`、`make gosec`
- 如 lint 脚本不存在：执行 `make build` 检查编译
- 如构建失败：分析错误并修复
- 最低要求：代码无编译错误、无明显语法问题

**前端检查**：

- 优先执行：`pnpm lint`、`pnpm type-check`
- 如脚本不存在：执行 `pnpm build` 检查编译
- 如构建失败：检查 TypeScript 类型错误、导入路径等
- 最低要求：代码无编译错误、无 TypeScript 类型错误

**验证清单**：

- [ ] Sandbox 环境已检查，所有命令在 sandbox 内执行（如有）
- [ ] 专门 Skills 已查询并优先使用
- [ ] 代码生成命令已执行（无手动创建）
- [ ] 初始模板已识别并替换（如有），替换后 `grep` 确认模板关键词零命中
- [ ] 所有文件内容完整，无 TODO/占位符
- [ ] 代码质量检查已执行（至少编译检查）
- [ ] 私有仓库问题已在 sandbox 内尝试解决
- [ ] 所有完成的任务确实完成，未完成的保持未完成状态
- [ ] `tasks.md` 标记准确，无禁止标记
- [ ] （含菜单 SQL）sqlimport 已在 sandbox 内执行，数据入库已验证，相关 Redis 缓存已清理
- [ ] （含前端 HTTP 请求）已探索现有封装模式并复用，未自造新封装
- [ ] （含前端 HTTP 请求）所用 env 变量已在 .env.* 中确认存在
- [ ] （含前端 HTTP 请求）API 路径已对照 nginx.conf 或运行时域名配置确认可正确路由到后端

### 3. 输出执行结果

执行完成后，**必须**将本次执行结果写入 prompt 指定的路径（如 `docs/{{gitBranch}}/applyResult.md`）。

**文件格式**：

```markdown
## 本次修改的文件

- backend/src/biz/xxx.go (新增)
- backend/src/data/yyy.go (修改)
- frontend/src/pages/zzz.vue (新增)

## 本次完成的任务

- 3.1 任务名称 ✅
- 3.2 任务名称 ✅

## 本次未完成的任务

- 3.3 任务名称 📝 原因说明

```

**注意事项**：

- 若输出目录不存在，需先创建
- 每次执行都**覆盖**此文件（不是追加）
- 文件列表只包含本次执行修改的文件
- 任务列表只包含本次执行涉及的任务
