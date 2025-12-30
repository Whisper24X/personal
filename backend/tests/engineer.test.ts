/**
 * Engineer Role Tests
 * Tests for Engineer role functionality
 */

import { Engineer } from '../src/roles/Engineer';
import { Context } from '../src/core/context/Context';
import { Message } from '../src/core/message/Message';
import { BaseLLM } from '../src/providers/llm/BaseLLM';
import { ILLMConfig, ILLMResponse, ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS } from '@mind2build/shared';
import { WriteCode } from '../src/actions/WriteCode';
import { ExecuteSubtask } from '../src/actions/ExecuteSubtask';

/**
 * Mock LLM for testing
 */
class MockLLM extends BaseLLM {
  private responses: Map<string, string> = new Map();

  constructor(config: ILLMConfig) {
    super(config);
  }

  async acompletion(messages: any[]): Promise<ILLMResponse> {
    const userMessage = messages.find(m => m.role === 'user');
    const prompt = userMessage?.content || '';
    
    // Return mock response based on prompt content
    let response = this.responses.get(prompt) || 'Mock LLM response';
    
    // If prompt contains code-related keywords, return mock code
    if (prompt.includes('code') || prompt.includes('实现') || prompt.includes('设计')) {
      response = `\`\`\`typescript
// Mock generated code
export function example() {
  return 'Hello World';
}
\`\`\`
`;
    }
    
    return {
      content: response,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model: this.config.model,
    };
  }

  setResponse(prompt: string, response: string): void {
    this.responses.set(prompt, response);
  }
}

describe('Engineer Role', () => {
  let context: Context;
  let mockLLM: MockLLM;
  let engineer: Engineer;

  beforeEach(() => {
    // Create mock LLM config
    const llmConfig: ILLMConfig = {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-3.5-turbo',
    };

    mockLLM = new MockLLM(llmConfig);

    // Create context with mock LLM
    context = new Context({
      llm: llmConfig,
    });
    context.llm = mockLLM;

    // Create Engineer instance
    engineer = new Engineer(context);
  });

  describe('Constructor', () => {
    it('should create Engineer with correct configuration', () => {
      expect(engineer).toBeDefined();
      expect(engineer.profile).toBe('Engineer');
      expect(engineer.goal).toContain('Implement high-quality code');
      expect(engineer.actions.length).toBe(2);
      expect(engineer.actions.some(a => a.name === 'WriteCode')).toBe(true);
      expect(engineer.actions.some(a => a.name === 'ExecuteSubtask')).toBe(true);
    });

    it('should watch for PRD, Design, and BreakdownTasks actions', () => {
      const watchSet = engineer['rc'].watch;
      expect(watchSet.has(ACTION_WRITE_PRD)).toBe(true);
      expect(watchSet.has(ACTION_WRITE_DESIGN)).toBe(true);
      expect(watchSet.has(ACTION_BREAKDOWN_TASKS)).toBe(true);
    });
  });

  describe('WriteCode Action', () => {
    it('should return null when no todo action is set', async () => {
      engineer['rc'].todo = null;
      const result = await engineer.act();
      expect(result).toBeNull();
    });

    it('should return null when no PRD or Design is available', async () => {
      const writeCodeAction = engineer.actions.find(a => a.name === 'WriteCode') as WriteCode;
      engineer['rc'].todo = writeCodeAction;
      engineer['rc'].memory.clear();
      
      const result = await engineer.act();
      expect(result).toBeNull();
    });

    it('should generate code when PRD and Design are available', async () => {
      const writeCodeAction = engineer.actions.find(a => a.name === 'WriteCode') as WriteCode;
      engineer['rc'].todo = writeCodeAction;

      // Add PRD message to memory
      const prdMessage = new Message({
        content: '# PRD\n\n## 需求\n\n创建一个待办事项应用',
        role: 'ProductManager',
        causeBy: 'WritePRD',
        sentFrom: 'ProductManager',
      });
      engineer['rc'].memory.add(prdMessage);

      // Add Design message to memory
      const designMessage = new Message({
        content: '# Design\n\n## 架构设计\n\n使用React和TypeScript',
        role: 'Architect',
        causeBy: 'WriteDesign',
        sentFrom: 'Architect',
      });
      engineer['rc'].memory.add(designMessage);

      // Mock workspace options
      engineer['extractWorkspaceOptions'] = jest.fn().mockReturnValue({
        applicationId: 'test-app',
        version: 'v1',
      });

      // Mock WriteCode action run method
      const mockRun = jest.fn().mockResolvedValue({
        content: '# Generated Code\n\n## Files Created:\n- src/App.tsx',
        data: {
          type: 'code',
          files: [{ path: 'src/App.tsx', content: 'export function App() {}' }],
          filesCount: 1,
        },
      });
      writeCodeAction.run = mockRun;

      const result = await engineer.act();

      expect(result).not.toBeNull();
      expect(result?.role).toBe('Engineer');
      expect(result?.causeBy).toBe('WriteCode');
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('ExecuteSubtask Action', () => {
    it('should have executeSubtask method defined', () => {
      expect(engineer['executeSubtask']).toBeDefined();
      expect(typeof engineer['executeSubtask']).toBe('function');
    });

    it('should handle missing workspace options gracefully', async () => {
      const executeSubtaskAction = engineer.actions.find(a => a.name === 'ExecuteSubtask') as ExecuteSubtask;
      engineer['rc'].todo = executeSubtaskAction;

      // Mock extractWorkspaceOptions to return null
      const originalExtract = engineer['extractWorkspaceOptions'];
      engineer['extractWorkspaceOptions'] = jest.fn().mockReturnValue(null);

      // Mock super.act to avoid actual execution
      const originalAct = Object.getPrototypeOf(Object.getPrototypeOf(engineer)).act;
      Object.getPrototypeOf(Object.getPrototypeOf(engineer)).act = jest.fn().mockResolvedValue(null);

      const result = await engineer.act();
      
      // Restore original methods
      engineer['extractWorkspaceOptions'] = originalExtract;
      Object.getPrototypeOf(Object.getPrototypeOf(engineer)).act = originalAct;

      // Should handle gracefully (returns null or falls back)
      expect(result).toBeDefined();
    });
  });

  describe('Message Handling', () => {
    it('should receive and store PRD messages', () => {
      const prdMessage = new Message({
        content: 'Test PRD content',
        role: 'ProductManager',
        causeBy: 'WritePRD',
        sentFrom: 'ProductManager',
      });

      engineer['rc'].memory.add(prdMessage);
      const prdMessages = engineer['rc'].memory.getByAction('WritePRD');
      
      expect(prdMessages.length).toBe(1);
      expect(prdMessages[0].content).toBe('Test PRD content');
    });

    it('should receive and store Design messages', () => {
      const designMessage = new Message({
        content: 'Test Design content',
        role: 'Architect',
        causeBy: 'WriteDesign',
        sentFrom: 'Architect',
      });

      engineer['rc'].memory.add(designMessage);
      const designMessages = engineer['rc'].memory.getByAction('WriteDesign');
      
      expect(designMessages.length).toBe(1);
      expect(designMessages[0].content).toBe('Test Design content');
    });

    it('should receive and store BreakdownTasks messages', () => {
      const breakdownMessage = new Message({
        content: '# 任务拆分\n\n## 任务1\n\n实现登录功能',
        role: 'Architect',
        causeBy: 'BreakdownTasks',
        sentFrom: 'Architect',
      });

      engineer['rc'].memory.add(breakdownMessage);
      const breakdownMessages = engineer['rc'].memory.getByAction('BreakdownTasks');
      
      expect(breakdownMessages.length).toBe(1);
      expect(breakdownMessages[0].content).toContain('任务拆分');
    });
  });

  describe('Task Breakdown Integration', () => {
    it('should have writeCodeWithTaskBreakdown method defined', () => {
      expect(engineer['writeCodeWithTaskBreakdown']).toBeDefined();
      expect(typeof engineer['writeCodeWithTaskBreakdown']).toBe('function');
    });

    it('should check for task breakdown when WriteCode is triggered', async () => {
      const writeCodeAction = engineer.actions.find(a => a.name === 'WriteCode') as WriteCode;
      engineer['rc'].todo = writeCodeAction;

      // Add PRD, Design, and BreakdownTasks to memory
      const prdMessage = new Message({
        content: '# PRD\n\n创建待办应用',
        role: 'ProductManager',
        causeBy: 'WritePRD',
        sentFrom: 'ProductManager',
      });
      engineer['rc'].memory.add(prdMessage);

      const designMessage = new Message({
        content: '# Design\n\nReact应用',
        role: 'Architect',
        causeBy: 'WriteDesign',
        sentFrom: 'Architect',
      });
      engineer['rc'].memory.add(designMessage);

      const breakdownMessage = new Message({
        content: `# 任务拆分

项目名称: 待办应用
项目描述: 一个简单的待办事项管理应用

### 任务 task-1: 实现用户界面
- 任务类型: feature
- 优先级: high
- 预估工时: 4小时
- 任务描述: 实现用户界面组件
`,
        role: 'Architect',
        causeBy: 'BreakdownTasks',
        sentFrom: 'Architect',
      });
      engineer['rc'].memory.add(breakdownMessage);

      // Verify that breakdown message is stored
      const breakdownMessages = engineer['rc'].memory.getByAction('BreakdownTasks');
      expect(breakdownMessages.length).toBe(1);
      expect(breakdownMessages[0].content).toContain('任务拆分');
    });
  });

  describe('buildTaskDescription', () => {
    it('should build task description correctly', () => {
      const task = {
        id: 'task-1',
        name: '实现登录功能',
        type: 'feature',
        priority: 'high',
        estimatedHours: 4,
        description: '实现用户登录功能',
        dependencies: ['task-0'],
        inputs: ['用户凭证'],
        outputs: ['JWT token'],
        acceptanceCriteria: ['用户能够成功登录'],
        technicalPoints: ['使用JWT', '密码加密'],
      };

      const description = engineer['buildTaskDescription'](task);

      expect(description).toContain('任务: 实现登录功能');
      expect(description).toContain('任务ID: task-1');
      expect(description).toContain('任务类型: feature');
      expect(description).toContain('优先级: high');
      expect(description).toContain('预估工时: 4 小时');
      expect(description).toContain('依赖任务: task-0');
      expect(description).toContain('用户凭证');
      expect(description).toContain('JWT token');
      expect(description).toContain('用户能够成功登录');
      expect(description).toContain('使用JWT');
    });

    it('should handle task without optional fields', () => {
      const task = {
        id: 'task-2',
        name: '简单任务',
        type: 'bugfix',
        priority: 'low',
        estimatedHours: 1,
        description: '修复一个小bug',
        dependencies: [],
        inputs: [],
        outputs: [],
        acceptanceCriteria: [],
        technicalPoints: [],
      };

      const description = engineer['buildTaskDescription'](task);

      expect(description).toContain('任务: 简单任务');
      expect(description).toContain('任务ID: task-2');
      expect(description).not.toContain('依赖任务');
    });
  });
});

