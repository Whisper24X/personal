---
name: deploy-prepare
description: 部署前环境准备：检查 Docker 环境、代码完整性、构建配置，输出结果到 docs/deploy/prepareResult.md。当需要执行部署前检查、验证构建配置或校验代码完整性时使用。
---

# PrepareDeployment - 准备部署

在执行部署命令之前，完成所有必要的前置检查和环境准备工作。

## 输出规范（强制）

> **重要**：检查结果必须写入文件，不是输出到终端。

| 项目         | 规范                                       |
| ------------ | ------------------------------------------ |
| **结果文件** | `docs/deploy/prepareResult.md`             |
| **文件格式** | 固定两行：第一行状态，第二行原因           |
| **状态值**   | `已就绪` / `未就绪` / `检查失败`（三选一） |

## 执行步骤

### 1. Docker 环境检查（Linux 系统）

**检查项目**（必须全部通过）：

1. **Docker 服务状态**
   - 执行 `systemctl status docker` 检查 Docker 是否运行（rootfull 模式，系统级服务）
   - 如果 Docker 未运行，执行 `sudo systemctl start docker` 尝试启动

2. **Docker 可用性**（关键：部署流程通常会执行 `docker info`）
   - 执行 `docker info` 验证当前用户能否访问 Docker
   - 若 `docker info` 失败，后续容器化部署命令会失败，必须在此阶段发现并处理

**判定标准**：

| 情况                                | 判定      | 后续处理                                       |
| ----------------------------------- | --------- | ---------------------------------------------- |
| systemctl 正常且 `docker info` 成功 | ✅ 通过   | 继续后续检查                                   |
| Docker 未安装                       | ❌ 不通过 | 停止部署，要求安装 Docker                      |
| systemctl 正常但 `docker info` 失败 | ❌ 不通过 | 当前用户无 Docker 权限，提供加入 docker 组命令 |
| Docker 启动失败（其他原因）         | ❌ 不通过 | 记录错误详情，停止部署                         |

**禁止**：不得提及 Rootless、setup-rootless-docker.sh 或 subuid/subgid，已切换为 rootfull 模式。

### 2. 代码完整性检查

**检查范围**：项目根目录下所有源代码文件

**检查规则**：

- 检测代码中是否存在不完整标记：`TODO`、`FIXME`、`XXX`、`HACK`、`placeholder`、`伪代码`、`待实现`、`未实现`、`not implemented`
- 检测是否存在空函数体或空类
- 检测是否存在独立的 `...` 占位符（排除扩展运算符）
- 检测是否存在注释中的 `// ...` 占位符（排除说明性注释）

**判定标准**：

| 情况                             | 判定      |
| -------------------------------- | --------- |
| 无任何不完整标记                 | ✅ 通过   |
| 存在 TODO/FIXME 但不影响核心功能 | ⚠️ 警告   |
| 存在空函数体或未实现的核心功能   | ❌ 不通过 |

### 3. 构建配置验证

**检查项目**：

1. **依赖配置**
   - 检查 `package.json` 是否存在且完整
   - 检查 `node_modules` 是否已安装（或等效依赖目录）
   - 检查是否存在 lock 文件（`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`）

2. **构建脚本**
   - 检查是否存在构建命令（`build`、`dev`、`start` 等 npm scripts）
   - 检查 `Makefile` 是否存在，是否包含项目约定的启动或重启目标
   - 检查项目部署脚本是否存在

3. **TypeScript 配置**
   - 检查 `tsconfig.json` 是否存在
   - 检查 TypeScript 编译是否通过（执行 `tsc --noEmit` 或等效命令）

4. **环境配置**
   - 检查 `.env` 或环境配置文件是否存在
   - 检查必要的环境变量是否已设置
   - 不检查敏感信息的具体值，仅检查 key 是否存在

### 4. 部署环境准备

**执行步骤**：

1. **确保目录结构**
   - 确保 `docs/deploy/` 目录存在
   - 清理上次部署的临时文件（如有）

2. **构建检查**
   - 根据项目类型执行构建验证：
     - 前端项目：`pnpm build` 或 `npm run build`
     - 后端项目：`make build` 或 `tsc --noEmit`
     - 全栈项目：分别检查前后端
   - 如果构建失败，记录错误信息

## 结果写入

将结果写入 `docs/deploy/prepareResult.md`：

### 示例 - 已就绪

```
已就绪
代码完整性通过，构建配置验证通过，部署环境已准备就绪
```

### 示例 - 未就绪（Docker 服务未运行）

```
未就绪
Docker 启动失败：Docker 服务未运行。请执行 `sudo systemctl start docker` 启动服务后重新执行部署。
```

### 示例 - 未就绪（Docker 权限问题：systemctl 正常但 docker info 失败）

```
未就绪
Docker 在当前用户环境下不可用：systemctl 显示 Docker 服务已运行，但 `docker info` 失败（当前用户无权限访问 Docker socket）。请执行以下命令将当前用户加入 docker 组后重新登录或执行 `newgrp docker`：

sudo usermod -aG docker $USER
newgrp docker

然后重新执行部署准备。
```

### 示例 - 未就绪（构建失败）

```
未就绪
构建失败：TypeScript 编译错误 3 处（src/models/User.ts:15, src/routes/api.ts:42, src/utils/auth.ts:8）
```

### 示例 - 检查失败

```
检查失败
无法读取 package.json 文件，项目结构不完整
```
