/**
 * Memory class
 * Stores and retrieves messages for agent context
 */

import { Message } from '../message/Message';
import { anyToStr } from '@mind2build/shared';

export class Memory {
  private storage: Message[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add a message to memory
   */
  add(message: Message): void {
    this.storage.push(message);
    
    // Trim to max size if exceeded
    if (this.storage.length > this.maxSize) {
      this.storage = this.storage.slice(-this.maxSize);
    }
  }

  /**
   * Add multiple messages
   */
  addMany(messages: Message[]): void {
    messages.forEach((msg) => this.add(msg));
  }

  /**
   * Get all messages or last k messages
   */
  get(k: number = 0): Message[] {
    if (k === 0 || k >= this.storage.length) {
      return [...this.storage];
    }
    return this.storage.slice(-k);
  }

  /**
   * Get messages by role
   */
  getByRole(role: string): Message[] {
    return this.storage.filter((msg) => msg.role === role);
  }

  /**
   * Get messages by action type (cause_by)
   */
  getByAction(actionType: string | Function): Message[] {
    const actionStr = anyToStr(actionType);
    return this.storage.filter((msg) => msg.causeBy === actionStr);
  }

  /**
   * Get messages by multiple action types
   */
  getByActions(actionTypes: Array<string | Function>): Message[] {
    const actionStrs = actionTypes.map((a) => anyToStr(a));
    return this.storage.filter((msg) => actionStrs.includes(msg.causeBy));
  }

  /**
   * Search messages by content
   */
  searchByContent(query: string): Message[] {
    const lowerQuery = query.toLowerCase();
    return this.storage.filter((msg) =>
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get messages in a time range
   */
  getInTimeRange(_startTime: Date, _endTime: Date): Message[] {
    // Note: Messages don't have timestamps in current implementation
    // This is a placeholder for future enhancement
    return this.storage;
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.storage = [];
  }

  /**
   * Get memory size
   */
  get size(): number {
    return this.storage.length;
  }

  /**
   * Check if memory is empty
   */
  get isEmpty(): boolean {
    return this.storage.length === 0;
  }

  /**
   * Get the most recent message
   */
  get latest(): Message | undefined {
    return this.storage[this.storage.length - 1];
  }

  /**
   * Serialize to JSON
   */
  toJSON(): any {
    return {
      maxSize: this.maxSize,
      storage: this.storage.map((msg) => msg.toJSON()),
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): Memory {
    const memory = new Memory(data.maxSize);
    if (data.storage && Array.isArray(data.storage)) {
      memory.storage = data.storage.map((item: any) => Message.fromJSON(item));
    }
    return memory;
  }
}

export default Memory;

