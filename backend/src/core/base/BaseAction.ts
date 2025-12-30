/**
 * Base Action class
 * Abstract interface for all actions that agents can perform
 */

import { IActionOutput } from '@mind2build/shared';
import { Message } from '../message/Message';
import { WorkspaceManager, WorkspaceOptions } from '../../utils/WorkspaceManager';

export abstract class BaseAction {
  name: string;
  description?: string;

  // LLM instance will be injected by Role
  protected llm?: any;

  constructor(name?: string, description?: string) {
    this.name = name || this.constructor.name;
    this.description = description;
  }

  /**
   * Execute the action
   * @param args - Input arguments
   * @returns Action output
   */
  abstract run(...args: any[]): Promise<IActionOutput>;

  /**
   * Set LLM instance for this action
   */
  setLLM(llm: any): void {
    this.llm = llm;
  }

  /**
   * Helper method to call LLM with a prompt
   * @param prompt - The prompt to send to LLM
   * @param systemMsgs - Optional system messages
   */
  protected async aask(prompt: string, systemMsgs?: string[]): Promise<string> {
    if (!this.llm) {
      throw new Error('LLM not set for action');
    }
    return await this.llm.aask(prompt, systemMsgs);
  }

  /**
   * Helper method for chat completion
   * @param messages - Chat messages
   */
  protected async acompletion(messages: any[]): Promise<any> {
    if (!this.llm) {
      throw new Error('LLM not set for action');
    }
    return await this.llm.acompletion(messages);
  }

  /**
   * 保存文件到workspace（统一方法）
   * @param filePath 相对路径
   * @param content 文件内容
   * @param options workspace选项
   */
  protected async saveToWorkspace(
    filePath: string,
    content: string,
    options?: WorkspaceOptions
  ): Promise<void> {
    return WorkspaceManager.saveToWorkspace(filePath, content, options);
  }

  /**
   * 批量保存文件到workspace
   * @param files 文件数组
   * @param options workspace选项
   */
  protected async saveFilesToWorkspace(
    files: Array<{ path: string; content: string }>,
    options?: WorkspaceOptions
  ): Promise<void> {
    return WorkspaceManager.saveFilesToWorkspace(files, options);
  }

  /**
   * 获取workspace目录路径
   * @param options workspace选项
   */
  protected getWorkspaceDir(options?: WorkspaceOptions): string {
    return WorkspaceManager.getWorkspaceDir(options);
  }

  /**
   * 读取workspace文件
   * @param filePath 相对路径
   * @param options workspace选项
   */
  protected async readWorkspaceFile(
    filePath: string,
    options?: WorkspaceOptions
  ): Promise<string | null> {
    return WorkspaceManager.readFile(filePath, options);
  }

  /**
   * 读取workspace所有文件
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   */
  protected async readAllFromWorkspace(
    options?: WorkspaceOptions,
    filter?: (filename: string) => boolean
  ): Promise<string> {
    return WorkspaceManager.readAllFromWorkspace(options, filter);
  }

  /**
   * Convert action to string representation
   */
  toString(): string {
    return `${this.name}${this.description ? ` - ${this.description}` : ''}`;
  }

  /**
   * Serialize action to JSON
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      type: this.constructor.name,
    };
  }
}

export default BaseAction;

