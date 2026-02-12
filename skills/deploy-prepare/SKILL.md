---
name: deploy-prepare
description: 准备部署环境。检查代码完整性、验证构建配置、准备部署环境。无状态验证工具，由 Deploy Action 调用。触发场景：(1) 部署前环境检查 (2) 构建配置验证 (3) 代码完整性校验
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

**检查项目**：

1. **Docker 服务状态**
   - 执行 `systemctl --user status docker` 检查 Docker 是否运行
   - 如果 Docker 未运行，执行 `systemctl --user start docker` 尝试启动
   - 记录启动结果和错误信息

2. **Rootless Docker UID/GID 映射配置**（仅 Linux）

   检查 `/etc/subuid` 和 `/etc/subgid` 配置：

   ```bash
   # 检查 subuid 配置
   cat /etc/subuid
   # 检查 subgid 配置
   cat /etc/subgid
   # 获取当前用户 UID
   id -u
   ```

   **配置要求**：
   - 必须同时存在用户名格式和 UID 格式配置
   - 示例（假设用户 `master`，UID 为 `1000`）：
     ```
     master:100000:65536
     1000:100000:65536
     ```

   **常见错误**：

   | 错误现象                                                      | 原因               | 影响            |
   | ------------------------------------------------------------- | ------------------ | --------------- |
   | `newuidmap: write to uid_map failed: Operation not permitted` | 缺少 UID 格式配置  | Docker 无法启动 |
   | `could not find user master in /etc/subuid`                   | 缺少用户名格式配置 | Docker 无法启动 |

3. **修复指导**（如检测到配置问题）

   在 `prepareResult.md` 中提供详细的修复命令：

   ```bash
   # 1. 获取当前用户 UID
   USER_UID=$(id -u)

   # 2. 添加 UID 格式配置（需要 sudo 权限）
   sudo bash -c "echo \"${USER_UID}:100000:65536\" >> /etc/subuid"
   sudo bash -c "echo \"${USER_UID}:100000:65536\" >> /etc/subgid"

   # 3. 重启 Docker 服务
   systemctl --user restart docker

   # 4. 验证 Docker 状态
   systemctl --user status docker
   docker ps
   ```

**判定标准**：

| 情况                            | 判定      | 后续处理                  |
| ------------------------------- | --------- | ------------------------- |
| Docker 正常运行                 | ✅ 通过   | 继续后续检查              |
| Docker 未安装                   | ❌ 不通过 | 停止部署，要求安装 Docker |
| Docker 配置错误（UID/GID 映射） | ⚠️ 需修复 | 提供修复命令，停止部署    |
| Docker 启动失败（其他原因）     | ❌ 不通过 | 记录错误详情，停止部署    |

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
   - 检查 `Makefile` 是否存在，是否包含 `sandbox` 目标
   - 检查 `sandbox/sandbox.sh` 脚本是否存在

3. **TypeScript 配置**
   - 检查 `tsconfig.json` 是否存在
   - 检查 TypeScript 编译是否通过（执行 `tsc --noEmit` 或等效命令）

4. **环境配置**
   - 检查 `.env` 或环境配置文件是否存在
   - 检查必要的环境变量是否已设置
   - 不检查敏感信息的具体值，仅检查 key 是否存在

### 4. 部署环境准备

**执行步骤**：

1. **停止现有服务**
   - 执行 `make sandbox-stop`（无论服务是否在运行）
   - 等待停止命令执行完成
   - 如果没有 Makefile 或 sandbox 目标，跳过此步骤

2. **确保目录结构**
   - 确保 `docs/deploy/` 目录存在
   - 清理上次部署的临时文件（如有）

3. **构建检查**
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

### 示例 - 未就绪（Docker 配置问题）

```
未就绪
Docker 启动失败：Rootless Docker UID/GID 映射配置不完整。需要执行以下命令修复（需要 sudo 权限）：

# 获取当前用户 UID
USER_UID=$(id -u)

# 添加 UID 格式配置
sudo bash -c "echo \"${USER_UID}:100000:65536\" >> /etc/subuid"
sudo bash -c "echo \"${USER_UID}:100000:65536\" >> /etc/subgid"

# 重启 Docker 服务
systemctl --user restart docker

# 验证 Docker 状态
systemctl --user status docker

修复完成后，请重新执行部署。
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

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/deploy/prepareResult.md`，不是输出到终端
2. **文件格式固定**：只有两行，第一行是状态，第二行是原因（Docker 配置问题时可多行提供修复命令）
3. **确保目录存在**：如果 `docs/deploy/` 目录不存在，需要先创建
4. **不执行部署**：此 Skill 仅做检查和准备，不执行实际部署命令（`make sandbox`）
5. **构建失败不阻塞**：构建失败时记录错误但不终止流程，由 Deploy Action 决定是否继续
6. **Docker 配置问题优先检查**：Docker 环境问题会导致后续所有步骤失败，必须优先检查和修复
7. **Linux 系统特别注意**：Rootless Docker 需要正确的 UID/GID 映射配置，这是常见的部署前置问题
