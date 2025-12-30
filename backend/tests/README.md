# Engineer 角色测试指南

本文档说明如何单独测试 Engineer 角色的功能。

## 测试文件位置

测试文件位于：`backend/tests/engineer.test.ts`

## 运行测试

### 运行所有测试

```bash
cd backend
npm test
```

### 只运行 Engineer 角色测试

```bash
cd backend
npm test engineer.test.ts
```

### 以监视模式运行（自动重新运行）

```bash
cd backend
npm run test:watch
```

### 生成测试覆盖率报告

```bash
cd backend
npm run test:coverage
```

## 测试覆盖范围

### 1. 构造函数测试
- ✅ Engineer 实例创建
- ✅ 配置验证（profile, goal, actions）
- ✅ 消息监听配置（PRD, Design, BreakdownTasks）

### 2. WriteCode 功能测试
- ✅ 无待办任务时返回 null
- ✅ 无 PRD/Design 时返回 null
- ✅ 有 PRD 和 Design 时生成代码

### 3. ExecuteSubtask 功能测试
- ✅ 方法存在性验证
- ✅ 缺少 workspace 选项时的处理

### 4. 消息处理测试
- ✅ PRD 消息接收和存储
- ✅ Design 消息接收和存储
- ✅ BreakdownTasks 消息接收和存储

### 5. 任务拆分集成测试
- ✅ writeCodeWithTaskBreakdown 方法存在性
- ✅ 任务拆分消息的存储和检索

### 6. 任务描述构建测试
- ✅ 完整任务描述的构建
- ✅ 可选字段的处理

## 测试结构说明

### Mock LLM

测试使用 `MockLLM` 类来模拟 LLM 响应，避免实际调用 API：

```typescript
class MockLLM extends BaseLLM {
  async acompletion(messages: any[]): Promise<ILLMResponse> {
    // 返回模拟响应
  }
}
```

### 测试设置

每个测试用例都会：
1. 创建新的 Context 和 MockLLM
2. 创建新的 Engineer 实例
3. 设置必要的消息和状态
4. 执行测试
5. 验证结果

## 手动测试示例

如果你想手动测试 Engineer 角色（不使用 Jest），可以创建一个简单的测试脚本：

```typescript
// test-engineer-manual.ts
import { Engineer } from './src/roles/Engineer';
import { Context } from './src/core/context/Context';
import { Message } from './src/core/message/Message';
import { ACTION_WRITE_PRD, ACTION_WRITE_DESIGN } from '@mind2build/shared';

async function testEngineer() {
  // 创建 Context
  const context = new Context();
  
  // 创建 Engineer
  const engineer = new Engineer(context);
  
  // 添加 PRD 消息
  const prdMessage = new Message({
    content: '# PRD\n\n创建一个待办事项应用',
    role: 'ProductManager',
    causeBy: ACTION_WRITE_PRD,
    sentFrom: 'ProductManager',
  });
  engineer['rc'].memory.add(prdMessage);
  
  // 添加 Design 消息
  const designMessage = new Message({
    content: '# Design\n\n使用 React 和 TypeScript',
    role: 'Architect',
    causeBy: ACTION_WRITE_DESIGN,
    sentFrom: 'Architect',
  });
  engineer['rc'].memory.add(designMessage);
  
  // 设置 WriteCode 为待办任务
  const writeCodeAction = engineer.actions.find(a => a.name === 'WriteCode');
  engineer['rc'].todo = writeCodeAction!;
  
  // 执行
  const result = await engineer.act();
  
  console.log('Result:', result);
}

testEngineer().catch(console.error);
```

运行手动测试：

```bash
cd backend
tsx test-engineer-manual.ts
```

## 注意事项

1. **LLM Mock**: 测试使用 MockLLM，不会实际调用 LLM API，因此不会产生费用
2. **Workspace**: 某些测试需要 workspace 选项，测试中会 mock 这些选项
3. **异步操作**: 所有测试都是异步的，使用 `async/await`
4. **依赖**: 确保已安装所有依赖：`npm install`

## 扩展测试

要添加新的测试用例：

1. 在相应的 `describe` 块中添加新的 `it` 测试用例
2. 设置必要的 mock 和状态
3. 执行操作并验证结果
4. 运行测试确保通过

示例：

```typescript
it('should handle custom scenario', async () => {
  // 1. 设置测试数据
  // 2. 执行操作
  // 3. 验证结果
  expect(result).toBeDefined();
});
```

## 故障排除

### 测试失败：找不到模块

确保已安装依赖：
```bash
npm install
```

### 测试失败：类型错误

确保 TypeScript 配置正确，运行：
```bash
npm run build
```

### 测试超时

某些测试可能需要较长时间，可以在 Jest 配置中增加超时时间，或检查是否有无限循环。

## 相关文档

- [Jest 文档](https://jestjs.io/docs/getting-started)
- [TypeScript 测试指南](https://jestjs.io/docs/getting-started#using-typescript)
- Engineer 角色实现：`backend/src/roles/Engineer.ts`

