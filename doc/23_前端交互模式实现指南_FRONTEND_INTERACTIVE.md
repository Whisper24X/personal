# 前端交互模式实现指南

**文档版本**: v1.1  
**创建日期**: 2025-12-25  
**最后更新**: 2026-01-21

## 概述

本文档说明如何在 Web UI 中使用交互式确认功能，以及前后端如何通信。

## 前端组件

### 1. InteractiveConfirmation.vue

核心交互确认组件，提供：
- ✅ 内容预览和完整查看
- ✅ 6 种用户操作（继续、编辑、重新生成、查看、跳过、退出）
- ✅ 在线编辑功能
- ✅ 键盘快捷键支持 (C/E/R/V/S/Q)
- ✅ 文件列表展示

**Props**:
```typescript
interface RoleInfo {
  role: string;           // 角色名称
  action: string;         // 动作名称
  content: string;        // 生成的内容
  outputFiles?: string[]; // 输出的文件列表
}
```

**Events**:
```typescript
emit('action', action: string, modifiedContent?: string)
```

### 2. ProjectInteractive.vue

交互式项目生成页面，包含：
- ✅ 项目信息展示
- ✅ 进度时间线
- ✅ 实时步骤展示
- ✅ 完成摘要和统计
- ✅ WebSocket/SSE 连接管理

### 3. ProjectCreate.vue 更新

添加了模式选择：
- **自动模式**: 传统的自动生成，无需人工干预
- **交互模式**: 每个步骤等待用户确认

## 使用流程

### 用户流程

1. **创建项目**
   - 访问 `/create` 页面
   - 填写项目信息
   - 选择"Interactive Mode"
   - 点击"Create and Start Project"

2. **交互式生成**
   - 自动跳转到 `/project/interactive` 页面
   - 系统开始生成（ProductManager → Architect → Engineer）
   - 每个角色完成后暂停，展示确认界面

3. **用户操作**
   - 查看生成的内容
   - 选择操作：
     - **C (Continue)**: 接受并继续
     - **E (Edit)**: 在线编辑内容
     - **R (Regenerate)**: 重新生成
     - **V (View)**: 查看完整内容
     - **S (Skip)**: 跳过当前步骤
     - **Q (Quit)**: 保存并退出

4. **完成**
   - 所有步骤完成后显示摘要
   - 可以查看项目详情或下载文件

## 后端 API 要求

### 1. 创建交互式会话

```http
POST /api/projects/interactive
Content-Type: application/json

{
  "name": "项目名称",
  "idea": "项目想法",
  "description": "项目描述",
  "investment": 10.0,
  "nRound": 5
}

Response:
{
  "sessionId": "session-uuid",
  "project": { ... }
}
```

### 2. WebSocket 连接

```
ws://localhost:3000/api/interactive/:sessionId
```

**服务端消息格式**:

#### 角色开始工作
```json
{
  "type": "role_start",
  "data": {
    "role": "ProductManager",
    "action": "WritePRD"
  }
}
```

#### 角色完成，等待确认
```json
{
  "type": "confirmation_required",
  "data": {
    "role": "ProductManager",
    "action": "WritePRD",
    "content": "生成的内容...",
    "outputFiles": ["PRD.md"]
  }
}
```

#### 进度更新
```json
{
  "type": "progress",
  "data": {
    "currentRound": 1,
    "totalCost": 0.15,
    "message": "正在执行..."
  }
}
```

#### 完成
```json
{
  "type": "completed",
  "data": {
    "projectId": "project-uuid",
    "summary": {
      "totalSteps": 3,
      "totalCost": 0.45,
      "duration": 180000
    }
  }
}
```

**客户端消息格式**:

#### 用户操作
```json
{
  "type": "user_action",
  "action": "continue" | "edit" | "regenerate" | "skip" | "quit",
  "modifiedContent": "修改后的内容（仅 edit 时提供）"
}
```

### 3. SSE 备选方案

如果不使用 WebSocket，可以使用 Server-Sent Events:

```http
GET /api/interactive/:sessionId/stream
Accept: text/event-stream

Response (SSE):
event: role_start
data: {"role":"ProductManager","action":"WritePRD"}

event: confirmation_required
data: {"role":"ProductManager","action":"WritePRD","content":"..."}

event: completed
data: {"projectId":"...","summary":{...}}
```

用户操作通过 POST 请求发送:
```http
POST /api/interactive/:sessionId/action
Content-Type: application/json

{
  "action": "continue",
  "modifiedContent": "..."
}
```

## 实现细节

### 前端状态管理

```typescript
// 在 ProjectInteractive.vue 中
const state = {
  isRunning: false,          // 是否正在生成
  isCompleted: false,        // 是否已完成
  currentStep: null,         // 当前等待确认的步骤
  completedSteps: [],        // 已完成的步骤
  ws: null,                  // WebSocket 连接
  sessionId: null,           // 会话 ID
}
```

### WebSocket 连接管理

```typescript
function connectWebSocket(sessionId: string) {
  ws = new WebSocket(`ws://localhost:3000/api/interactive/${sessionId}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    ElMessage.error('Connection error');
  };
  
  ws.onclose = () => {
    console.log('WebSocket closed');
  };
}

function sendUserAction(action: string, modifiedContent?: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    ElMessage.error('连接已断开');
    return;
  }
  
  ws.send(JSON.stringify({
    type: 'user_action',
    action,
    modifiedContent,
  }));
}
```

### 服务端消息处理

```typescript
function handleServerMessage(message: any) {
  switch (message.type) {
    case 'role_start':
      runningRole.value = message.data.role;
      isRunning.value = true;
      break;
      
    case 'confirmation_required':
      currentStep.value = message.data;
      runningRole.value = '';
      break;
      
    case 'progress':
      currentRound.value = message.data.currentRound;
      totalCost.value = message.data.totalCost;
      break;
      
    case 'completed':
      isRunning.value = false;
      isCompleted.value = true;
      projectId.value = message.data.projectId;
      break;
      
    case 'error':
      ElMessage.error(message.data.message);
      break;
  }
}
```

## 后端实现建议

### 1. 交互式会话管理器

```typescript
// backend/src/orchestration/InteractiveSession.ts
export class InteractiveSession {
  private sessionId: string;
  private team: Team;
  private ws: WebSocket;
  private isPaused: boolean = false;
  private pendingMessage: Message | null = null;

  async start() {
    // 启动团队工作
    // 在每个角色完成后暂停并等待用户确认
  }

  async waitForUserConfirmation(
    role: string,
    action: string,
    content: string
  ): Promise<UserAction> {
    this.isPaused = true;
    
    // 发送 confirmation_required 消息
    this.ws.send(JSON.stringify({
      type: 'confirmation_required',
      data: { role, action, content }
    }));
    
    // 等待用户响应
    return new Promise((resolve) => {
      this.onUserAction = resolve;
    });
  }
  
  handleUserAction(action: string, modifiedContent?: string) {
    this.isPaused = false;
    this.onUserAction?.({ action, modifiedContent });
  }
}
```

### 2. WebSocket 路由

```typescript
// backend/src/api/routes/interactive.ts
import { Router } from 'express';
import { WebSocketServer } from 'ws';

const router = Router();

// 创建交互式会话
router.post('/interactive', async (req, res) => {
  const session = await InteractiveSessionManager.create(req.body);
  res.json({ sessionId: session.id, project: session.project });
});

// WebSocket 升级
export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const sessionId = extractSessionId(req.url);
    const session = InteractiveSessionManager.get(sessionId);
    
    if (!session) {
      ws.close(1008, 'Session not found');
      return;
    }
    
    session.setWebSocket(ws);
    session.start();
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'user_action') {
        session.handleUserAction(
          message.action,
          message.modifiedContent
        );
      }
    });
  });
}
```

### 3. 修改 Environment.ts

```typescript
// 在 runRolesSequentially 中添加 WebSocket 支持
private async runRolesSequentially(roles: Role[]): Promise<void> {
  for (const role of roles) {
    // ... 执行角色 ...
    
    if (message && this.interactiveHandler?.enabled) {
      // 如果是 Web 模式，通过 WebSocket 发送
      if (this.webSession) {
        const result = await this.webSession.waitForUserConfirmation(
          role.profile,
          message.causeBy,
          message.content
        );
        // 处理结果...
      } else {
        // CLI 模式，使用原有逻辑
        const result = await this.interactiveHandler.waitForConfirmation(...);
        // 处理结果...
      }
    }
  }
}
```

## 安全考虑

### 1. 会话认证

```typescript
// 验证会话所有权
function verifySession(sessionId: string, userId: string): boolean {
  const session = sessions.get(sessionId);
  return session && session.userId === userId;
}
```

### 2. 会话超时

```typescript
// 30 分钟无活动自动过期
const SESSION_TIMEOUT = 30 * 60 * 1000;

class InteractiveSession {
  private lastActivity: number = Date.now();
  
  updateActivity() {
    this.lastActivity = Date.now();
  }
  
  isExpired(): boolean {
    return Date.now() - this.lastActivity > SESSION_TIMEOUT;
  }
}
```

### 3. 内容大小限制

```typescript
// 限制编辑内容大小
const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB

if (modifiedContent.length > MAX_CONTENT_SIZE) {
  throw new Error('Content too large');
}
```

## 测试

### 前端测试

```typescript
// 测试组件渲染
describe('InteractiveConfirmation', () => {
  it('should render role info correctly', () => {
    const wrapper = mount(InteractiveConfirmation, {
      props: {
        roleInfo: {
          role: 'ProductManager',
          action: 'WritePRD',
          content: 'Test content',
        }
      }
    });
    
    expect(wrapper.text()).toContain('ProductManager');
    expect(wrapper.text()).toContain('WritePRD');
  });
  
  it('should emit action when button clicked', async () => {
    const wrapper = mount(InteractiveConfirmation, { ... });
    
    await wrapper.find('.continue-button').trigger('click');
    
    expect(wrapper.emitted('action')).toBeTruthy();
    expect(wrapper.emitted('action')[0]).toEqual(['continue']);
  });
});
```

### 集成测试

```typescript
// 测试完整流程
describe('Interactive Flow', () => {
  it('should complete interactive generation', async () => {
    // 1. 创建会话
    const session = await createSession({ ... });
    
    // 2. 连接 WebSocket
    const ws = new WebSocket(`ws://.../${session.id}`);
    
    // 3. 模拟用户操作
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'confirmation_required') {
        ws.send(JSON.stringify({
          type: 'user_action',
          action: 'continue',
        }));
      }
    });
    
    // 4. 验证完成
    await waitForCompletion();
    expect(session.status).toBe('completed');
  });
});
```

## 性能优化

### 1. 内容压缩

对于大文件，使用压缩传输：

```typescript
// 服务端
import zlib from 'zlib';

const compressed = zlib.gzipSync(content);
ws.send(compressed);

// 客户端
const decompressed = pako.ungzip(data);
```

### 2. 增量更新

只传输变更部分：

```typescript
interface ContentDelta {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content: string;
}
```

### 3. 连接重连

```typescript
function setupReconnect() {
  let reconnectAttempts = 0;
  const maxAttempts = 5;
  
  ws.onclose = () => {
    if (reconnectAttempts < maxAttempts) {
      setTimeout(() => {
        reconnectAttempts++;
        connectWebSocket(sessionId);
      }, 1000 * reconnectAttempts);
    }
  };
}
```

## 故障排查

### 常见问题

1. **WebSocket 连接失败**
   - 检查端口是否开放
   - 检查防火墙配置
   - 验证会话 ID 是否有效

2. **消息丢失**
   - 实现消息队列
   - 添加消息确认机制
   - 使用消息ID去重

3. **会话状态不同步**
   - 定期发送心跳
   - 实现状态快照
   - 添加重新同步机制

## 未来改进

- [ ] 支持多人协作审查
- [ ] 添加评论和批注功能
- [ ] 实时代码 diff 展示
- [ ] 语音输入支持
- [ ] 移动端优化

---

**相关文档**:
- [交互模式使用指南](./22_交互模式使用指南_INTERACTIVE.md)
- [产品需求文档](./02_产品需求文档_PRD.md)
- [API 参考文档](./12_API参考文档_API.md)

**更新记录**:
- 2026-01-21: 更新文档版本号和日期

