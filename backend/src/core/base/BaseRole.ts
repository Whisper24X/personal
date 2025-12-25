/**
 * Base Role interface
 * Defines the contract for all AI agent roles
 */

import { Message } from '../message/Message';

export abstract class BaseRole {
  name: string;
  profile: string;

  constructor(name: string, profile: string) {
    this.name = name;
    this.profile = profile;
  }

  /**
   * Check if role is idle (no pending work)
   */
  abstract get isIdle(): boolean;

  /**
   * Observe environment and receive messages
   * @returns Number of new messages received
   */
  abstract observe(): Promise<number>;

  /**
   * Think about what action to take next
   * @returns True if there's work to do, false otherwise
   */
  abstract think(): Promise<boolean>;

  /**
   * Execute the current action
   * @returns Message produced by the action
   */
  abstract act(): Promise<Message | null>;

  /**
   * Main execution loop: observe -> think -> act
   * @returns Message produced or null
   */
  abstract run(): Promise<Message | null>;

  /**
   * Get recent memories/messages
   * @param k - Number of recent messages to retrieve (0 = all)
   */
  abstract getMemories(k?: number): Message[];

  /**
   * Convert role to string representation
   */
  toString(): string {
    return `${this.profile}(${this.name})`;
  }
}

export default BaseRole;

