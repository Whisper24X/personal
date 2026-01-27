/**
 * SubtaskManager
 * 管理子任务的拆解和解析
 */

import { logger } from './logger';

export interface Subtask {
  id: string;
  name: string;
  type: string; // 前端/后端
  priority: string; // P0/P1/P2/P3
  estimatedHours: number;
  dependencies: string[]; // 依赖的任务ID列表
  description: string;
  inputs: string[];
  outputs: string[];
  acceptanceCriteria: string[];
  technicalPoints: string[];
}

export interface TaskBreakdown {
  projectName: string;
  projectDescription: string;
  tasks: Subtask[];
  createdAt: string;
}

export class SubtaskManager {
  private tasks: Map<string, Subtask> = new Map();

  /**
   * 解析任务拆分文档
   * @param taskBreakdownContent 任务拆分文档内容
   */
  parseTaskBreakdown(taskBreakdownContent: string): TaskBreakdown {
    this.tasks.clear();

    // 解析项目信息
    const projectNameMatch = taskBreakdownContent.match(/项目名称[：:]\s*(.+)/);
    const projectDescMatch = taskBreakdownContent.match(/项目描述[：:]\s*(.+)/);

    const projectName = projectNameMatch?.[1]?.trim() || 'Unknown Project';
    const projectDescription = projectDescMatch?.[1]?.trim() || '';

    // 解析任务列表
    // 匹配任务块，格式：### 任务 {task_id}: {task_name}
    const taskRegex = /###\s*任务\s*([^:：]+)[：:]\s*(.+?)(?=###|$)/gs;
    let match;
    const tasks: Subtask[] = [];

    while ((match = taskRegex.exec(taskBreakdownContent)) !== null) {
      const taskBlock = match[0];
      const taskId = match[1].trim();
      const taskName = match[2].trim();

      // 解析任务详情
      const task: Subtask = {
        id: taskId,
        name: taskName,
        type: this.extractField(taskBlock, '任务类型', '未知'),
        priority: this.extractField(taskBlock, '优先级', 'P3'),
        estimatedHours: this.parseEstimatedHours(
          this.extractField(taskBlock, '预估工时', '0')
        ),
        dependencies: this.extractDependencies(
          this.extractField(taskBlock, '依赖任务', '无')
        ),
        description: this.extractField(taskBlock, '任务描述', ''),
        inputs: this.extractList(taskBlock, '输入'),
        outputs: this.extractList(taskBlock, '输出'),
        acceptanceCriteria: this.extractList(taskBlock, '验收标准'),
        technicalPoints: this.extractList(taskBlock, '技术要点'),
      };

      tasks.push(task);
      this.tasks.set(taskId, task);
    }

    logger.info('SubtaskManager: Parsed task breakdown', {
      projectName,
      taskCount: tasks.length,
    });

    return {
      projectName,
      projectDescription,
      tasks,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 提取字段值
   */
  private extractField(
    content: string,
    fieldName: string,
    defaultValue: string = ''
  ): string {
    const regex = new RegExp(
      `[-*]\\s*\\*\\*${fieldName}\\*\\*[：:]\\s*(.+?)(?=\\n[-*]|$)`,
      's'
    );
    const match = content.match(regex);
    return match?.[1]?.trim() || defaultValue;
  }

  /**
   * 提取列表项
   */
  private extractList(content: string, fieldName: string): string[] {
    const fieldContent = this.extractField(content, fieldName, '');
    if (!fieldContent) return [];

    // 匹配列表项（支持 - 或 * 开头的列表）
    const items = fieldContent
      .split(/\n/)
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0);

    return items;
  }

  /**
   * 解析预估工时
   */
  private parseEstimatedHours(text: string): number {
    const match = text.match(/(\d+)\s*小时/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * 解析依赖任务列表
   */
  private extractDependencies(text: string): string[] {
    if (!text || text === '无' || text === '无依赖') {
      return [];
    }

    // 提取任务ID（可能是 T1, T2, Task-1 等格式）
    const taskIdRegex = /T\d+|Task[-_]?\d+|任务\s*\d+/gi;
    const matches = text.match(taskIdRegex);
    return matches ? matches.map((id) => id.trim()) : [];
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Subtask[] {
    return Array.from(this.tasks.values());
  }
}

