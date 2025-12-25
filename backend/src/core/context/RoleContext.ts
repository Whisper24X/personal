/**
 * Role Context
 * Runtime context for a specific role instance
 */

import { RoleReactMode } from '@mind2build/shared';
import { MessageQueue } from '../message/MessageQueue';
import { Message } from '../message/Message';
import { BaseAction } from '../base/BaseAction';
import { Memory } from '../memory/Memory';
import { ShortTermMemory } from '../memory/ShortTermMemory';

export class RoleContext {
  // Environment reference (set by Environment)
  env?: any;

  // Message buffer for async updates
  msgBuffer: MessageQueue = new MessageQueue();

  // Memory systems
  memory: Memory = new Memory(100);
  workingMemory: ShortTermMemory = new ShortTermMemory(10);

  // Current state (-1 = initial/terminal)
  state: number = -1;

  // Current action to execute
  todo: BaseAction | null = null;

  // Actions this role watches/subscribes to
  watch: Set<string> = new Set();

  // Recent news/messages (for temporary storage)
  news: Message[] = [];

  // React mode
  reactMode: RoleReactMode = RoleReactMode.BY_ORDER;

  // Maximum react loop iterations
  maxReactLoop: number = 1;

  constructor(params?: {
    reactMode?: RoleReactMode;
    maxReactLoop?: number;
    watch?: string[];
  }) {
    if (params) {
      this.reactMode = params.reactMode || RoleReactMode.BY_ORDER;
      this.maxReactLoop = params.maxReactLoop || 1;
      if (params.watch) {
        this.watch = new Set(params.watch);
      }
    }
  }

  /**
   * Get important memories (messages from watched actions)
   */
  get importantMemory(): Message[] {
    return this.memory.getByActions(Array.from(this.watch));
  }

  /**
   * Get message history
   */
  get history(): Message[] {
    return this.memory.get();
  }
  
  /**
   * Add message to memory
   */
  addToMemory(message: Message): void {
    this.memory.add(message);
    this.workingMemory.add(message);
  }

  /**
   * Add a message to the buffer
   */
  putMessage(message: Message): void {
    this.msgBuffer.push(message);
  }

  /**
   * Get all buffered messages
   */
  getBufferedMessages(): Message[] {
    return this.msgBuffer.popAll();
  }

  /**
   * Clear message buffer
   */
  clearBuffer(): void {
    this.msgBuffer.clear();
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    return {
      state: this.state,
      watch: Array.from(this.watch),
      reactMode: this.reactMode,
      maxReactLoop: this.maxReactLoop,
      msgBuffer: this.msgBuffer.toJSON(),
      memory: this.memory.toJSON(),
      workingMemory: this.workingMemory.toJSON(),
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): RoleContext {
    const rc = new RoleContext({
      reactMode: data.reactMode,
      maxReactLoop: data.maxReactLoop,
      watch: data.watch,
    });
    
    rc.state = data.state || -1;
    
    if (data.msgBuffer) {
      rc.msgBuffer = MessageQueue.fromJSON(data.msgBuffer);
    }
    
    if (data.memory) {
      rc.memory = Memory.fromJSON(data.memory);
    }
    
    if (data.workingMemory) {
      rc.workingMemory = ShortTermMemory.fromJSON(data.workingMemory);
    }
    
    return rc;
  }
}

export default RoleContext;

