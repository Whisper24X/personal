/**
 * Short Term Memory
 * Rolling window of recent messages with fixed size
 */

import { Memory } from './Memory';
import { Message } from '../message/Message';

export class ShortTermMemory extends Memory {
  constructor(windowSize: number = 10) {
    super(windowSize);
  }

  /**
   * Add message with automatic window management
   */
  add(message: Message): void {
    super.add(message);
    // Parent class already handles max size trimming
  }

  /**
   * Get messages within the window
   */
  getWindow(): Message[] {
    return this.get();
  }

  /**
   * Get messages by importance (messages from watched actions)
   */
  getImportant(watchedActions: Set<string>): Message[] {
    return this.get().filter((msg) => watchedActions.has(msg.causeBy));
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): ShortTermMemory {
    const memory = new ShortTermMemory(data.maxSize);
    if (data.storage && Array.isArray(data.storage)) {
      (memory as any).storage = data.storage.map((item: any) => Message.fromJSON(item));
    }
    return memory;
  }
}

export default ShortTermMemory;

