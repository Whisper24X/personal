# Git Page - Branch Management Center (重构版)

## 设计变更说明

**原计划**：在现有页面基础上添加5个功能
**新方向**：重构为"分支管理中心"，聚焦本地/远程分支关系

## 核心理念

让本地分支和远程分支的关系一目了然，帮助开发者快速理解分支状态和同步情况。

## 目标页面设计

### 布局结构

```
┌─────────────────────────────────────────────────┐
│ 顶部操作栏                                       │
│ [创建分支] [刷新] [筛选: 全部▾]                 │
├─────────────────────────────────────────────────┤
│ 分支列表（表格形式）                             │
│ 每行显示：分支名、状态、同步状态、最后提交、操作 │
│ 点击展开：显示该分支最近的提交                   │
└─────────────────────────────────────────────────┘
```

### 关键特性

**1. 分支状态分类**
- 🟢 本地+远程：已跟踪的分支
- 🔵 仅本地：未推送的新分支
- 🟡 仅远程：未checkout的远程分支
- ⭐ 当前分支：高亮显示

**2. 同步状态显示**
- ✓ 已同步：本地和远程一致
- ↑N：领先远程N个提交（需要推送）
- ↓N：落后远程N个提交（需要拉取）
- ↑N↓M：既领先又落后（有分叉）

**3. 智能操作按钮**
- 当前分支：禁用"切换"按钮
- 有未推送提交：显示"推送"按钮
- 落后远程：显示"拉取"按钮
- 所有分支：显示"删除"按钮（需确认）

**4. 可展开详情**
- 点击分支行展开/收起
- 显示该分支最近3-5个提交
- 显示分支创建信息

## 功能需求

### 必需功能
- [ ] 显示所有本地和远程分支列表
- [ ] 显示每个分支的同步状态（ahead/behind）
- [ ] 高亮当前分支
- [ ] 切换分支（checkout）
- [ ] 创建新分支
- [ ] 删除分支（本地/远程，需确认）
- [ ] 推送分支到远程
- [ ] 从远程拉取分支
- [ ] 展开查看分支的最近提交
- [ ] 刷新分支数据

### 可选功能
- [ ] 按状态筛选（全部/仅本地/仅远程/当前）
- [ ] 搜索分支名
- [ ] 排序（按名称/按时间）

## 移除的功能

从原设计中移除：
- ❌ 全局"拉取主分支"按钮（改为每个分支独立操作）
- ❌ 全局提交历史区域（改为分支内的提交）
- ❌ 未提交文件列表（建议移到独立的"工作区"页面）
- ❌ 仓库摘要卡片（信息整合到分支列表中）

## 技术要求

### 后端API需求

**新增API：**
```typescript
GET /git/branches-detail?projectId={id}
返回：{
  branches: Array<{
    name: string
    type: 'local' | 'remote' | 'both'
    isCurrent: boolean
    tracking?: string  // 跟踪的远程分支
    ahead: number      // 领先提交数
    behind: number     // 落后提交数
    lastCommit: {
      sha: string
      message: string
      author: string
      committedAt: string
    }
  }>
}

POST /git/checkout
请求：{ projectId: string, branch: string }

POST /git/create-branch
请求：{ projectId: string, name: string, from?: string }

DELETE /git/delete-branch
请求：{ projectId: string, branch: string, remote?: boolean }

POST /git/pull-branch
请求：{ projectId: string, branch: string }

POST /git/push-branch
请求：{ projectId: string, branch: string }
```

### 前端实现

**文件修改：**
- `frontend/src/types/api/git.ts` - 添加新类型
- `frontend/src/api/git.ts` - 添加新API方法
- `frontend/src/views/git/index.vue` - 完全重写

**组件结构：**
- 保持单文件组件
- 使用简单的表格布局（div实现）
- 展开/收起用v-if控制

## 验收标准

- [ ] 所有分支正确显示，区分本地/远程/两者
- [ ] 当前分支高亮显示
- [ ] 同步状态准确显示（ahead/behind）
- [ ] 切换分支功能正常
- [ ] 创建分支功能正常
- [ ] 删除分支有确认提示
- [ ] 推送/拉取操作正常
- [ ] 展开分支显示提交列表
- [ ] 所有操作有loading状态
- [ ] 错误处理友好
- [ ] TypeScript类型检查通过
- [ ] ESLint检查通过

## 预估工作量

- 后端API：4-6小时
- 前端重构：6-8小时
- 测试：2-3小时
- **总计：12-17小时**
