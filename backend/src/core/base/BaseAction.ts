/**
 * Base Action class
 * Abstract interface for all actions that agents can perform
 */

import { IActionOutput } from '@mind2build/shared';
import { Message } from '../message/Message';

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

