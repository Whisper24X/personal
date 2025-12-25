/**
 * Message Queue for role message buffers
 * Async message queue with push/pop operations
 */

import Message from './Message';

export class MessageQueue {
  private queue: Message[] = [];

  /**
   * Add a message to the queue
   */
  push(message: Message): void {
    this.queue.push(message);
  }

  /**
   * Add multiple messages to the queue
   */
  pushMany(messages: Message[]): void {
    this.queue.push(...messages);
  }

  /**
   * Get and remove the first message
   */
  pop(): Message | undefined {
    return this.queue.shift();
  }

  /**
   * Get the first message without removing it
   */
  peek(): Message | undefined {
    return this.queue[0];
  }

  /**
   * Get all messages and clear the queue
   */
  popAll(): Message[] {
    const messages = [...this.queue];
    this.queue = [];
    return messages;
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get the number of messages in the queue
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get all messages without removing them
   */
  getAll(): Message[] {
    return [...this.queue];
  }

  /**
   * Filter messages by criteria
   */
  filter(predicate: (msg: Message) => boolean): Message[] {
    return this.queue.filter(predicate);
  }

  /**
   * Find first message matching criteria
   */
  find(predicate: (msg: Message) => boolean): Message | undefined {
    return this.queue.find(predicate);
  }

  /**
   * Serialize queue to JSON
   */
  toJSON(): any[] {
    return this.queue.map((msg) => msg.toJSON());
  }

  /**
   * Deserialize queue from JSON
   */
  static fromJSON(data: any[]): MessageQueue {
    const queue = new MessageQueue();
    queue.queue = data.map((item) => Message.fromJSON(item));
    return queue;
  }
}

export default MessageQueue;

