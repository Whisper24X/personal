/**
 * SubtaskManager
 * 管理子任务的拆解和执行完成检查
 */

import { logger } from './logger';
import { WorkspaceManager, WorkspaceOptions } from './WorkspaceManager';

export interface Subtask {
  id: string;
  name: string;
  type: string; // 前端/后端/全栈/基础设施
  priority: string; // P0/P1/P2/P3
  estimatedHours: number;
  dependencies: string[]; // 依赖的任务ID列表
  description: string;
  inputs: string[];
  outputs: string[];
  acceptanceCriteria: string[];
  technicalPoints: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedAt?: string;
  error?: string;
}

export interface TaskBreakdown {
  projectName: string;
  projectDescription: string;
  tasks: Subtask[];
  createdAt: string;
}

export class SubtaskManager {
  private tasks: Map<string, Subtask> = new Map();
  private breakdownContent: string = '';

  /**
   * 解析任务拆分文档
   * @param taskBreakdownContent 任务拆分文档内容
   */
  parseTaskBreakdown(taskBreakdownContent: string): TaskBreakdown {
    this.breakdownContent = taskBreakdownContent;
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
        status: 'pending',
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

  /**
   * 获取待执行的任务（没有依赖或依赖已完成）
   */
  getPendingTasks(): Subtask[] {
    return this.getAllTasks().filter((task) => {
      if (task.status !== 'pending') return false;

      // 检查依赖是否都已完成
      const allDependenciesCompleted = task.dependencies.every((depId) => {
        const depTask = this.tasks.get(depId);
        return depTask?.status === 'completed';
      });

      return allDependenciesCompleted;
    });
  }

  /**
   * 获取进行中的任务
   */
  getInProgressTasks(): Subtask[] {
    return this.getAllTasks().filter((task) => task.status === 'in_progress');
  }

  /**
   * 获取已完成的任务
   */
  getCompletedTasks(): Subtask[] {
    return this.getAllTasks().filter((task) => task.status === 'completed');
  }

  /**
   * 获取失败的任务
   */
  getFailedTasks(): Subtask[] {
    return this.getAllTasks().filter((task) => task.status === 'failed');
  }

  /**
   * 检查是否所有任务都已完成
   */
  areAllTasksCompleted(): boolean {
    const allTasks = this.getAllTasks();
    if (allTasks.length === 0) return false;

    return allTasks.every((task) => task.status === 'completed');
  }

  /**
   * 标记任务为进行中
   */
  markTaskInProgress(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'in_progress';
      logger.info('SubtaskManager: Task marked as in progress', { taskId });
    }
  }

  /**
   * 标记任务为已完成
   */
  markTaskCompleted(taskId: string, completedAt?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = completedAt || new Date().toISOString();
      logger.info('SubtaskManager: Task marked as completed', {
        taskId,
        completedAt: task.completedAt,
      });
    }
  }

  /**
   * 标记任务为失败
   */
  markTaskFailed(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error;
      logger.error('SubtaskManager: Task marked as failed', {
        taskId,
        error,
      });
    }
  }

  /**
   * 获取任务统计信息
   */
  getStatistics(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    completionRate: number;
  } {
    const allTasks = this.getAllTasks();
    const pending = this.getPendingTasks().length;
    const inProgress = this.getInProgressTasks().length;
    const completed = this.getCompletedTasks().length;
    const failed = this.getFailedTasks().length;

    return {
      total: allTasks.length,
      pending,
      inProgress,
      completed,
      failed,
      completionRate:
        allTasks.length > 0 ? (completed / allTasks.length) * 100 : 0,
    };
  }

  /**
   * 保存任务拆分结果到workspace
   */
  async saveToWorkspace(options?: WorkspaceOptions): Promise<void> {
    const breakdown: TaskBreakdown = {
      projectName: this.getAllTasks()[0]?.name || 'Unknown',
      projectDescription: '',
      tasks: this.getAllTasks(),
      createdAt: new Date().toISOString(),
    };

    // 保存JSON格式的任务数据
    const jsonContent = JSON.stringify(breakdown, null, 2);
    await WorkspaceManager.saveToWorkspace(
      'task_breakdown.json',
      jsonContent,
      options
    );

    // 保存原始文档
    if (this.breakdownContent) {
      await WorkspaceManager.saveToWorkspace(
        'TASK_BREAKDOWN.md',
        this.breakdownContent,
        options
      );
    }

    logger.info('SubtaskManager: Saved task breakdown to workspace', {
      taskCount: breakdown.tasks.length,
    });
  }

  /**
   * 从workspace加载任务拆分结果
   */
  async loadFromWorkspace(options?: WorkspaceOptions): Promise<boolean> {
    try {
      const jsonContent = await WorkspaceManager.readFile(
        'task_breakdown.json',
        options
      );

      if (!jsonContent) {
        return false;
      }

      const breakdown: TaskBreakdown = JSON.parse(jsonContent);
      this.tasks.clear();

      breakdown.tasks.forEach((task) => {
        this.tasks.set(task.id, task);
      });

      logger.info('SubtaskManager: Loaded task breakdown from workspace', {
        taskCount: breakdown.tasks.length,
      });

      return true;
    } catch (error: any) {
      logger.error('SubtaskManager: Failed to load from workspace', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 获取任务执行报告
   */
  getExecutionReport(): string {
    const stats = this.getStatistics();
    const completedTasks = this.getCompletedTasks();
    const failedTasks = this.getFailedTasks();
    const pendingTasks = this.getPendingTasks();

    let report = `# 任务执行报告\n\n`;
    report += `## 统计信息\n\n`;
    report += `- 总任务数: ${stats.total}\n`;
    report += `- 已完成: ${stats.completed} (${stats.completionRate.toFixed(1)}%)\n`;
    report += `- 进行中: ${stats.inProgress}\n`;
    report += `- 待执行: ${stats.pending}\n`;
    report += `- 失败: ${stats.failed}\n\n`;

    if (completedTasks.length > 0) {
      report += `## 已完成任务\n\n`;
      completedTasks.forEach((task) => {
        report += `- [✓] ${task.id}: ${task.name} (完成时间: ${task.completedAt})\n`;
      });
      report += `\n`;
    }

    if (failedTasks.length > 0) {
      report += `## 失败任务\n\n`;
      failedTasks.forEach((task) => {
        report += `- [✗] ${task.id}: ${task.name}\n`;
        report += `  错误: ${task.error}\n`;
      });
      report += `\n`;
    }

    if (pendingTasks.length > 0) {
      report += `## 待执行任务\n\n`;
      pendingTasks.forEach((task) => {
        const deps = task.dependencies.length > 0 ? task.dependencies.join(', ') : '无';
        report += `- [ ] ${task.id}: ${task.name} (依赖: ${deps})\n`;
      });
      report += `\n`;
    }

    return report;
  }
}

