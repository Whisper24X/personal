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

  /**
   * Reset role state
   * Called during rollback to clean up resources and stop ongoing operations
   * @param abortSignal - AbortSignal to cancel ongoing operations
   */
  async reset(abortSignal?: AbortSignal): Promise<void> {
    // Check abort signal
    if (abortSignal?.aborted) {
      return;
    }

    // Subclasses should override this method to:
    // 1. Call reset() on all actions
    // 2. Clean up role-specific resources
    // 3. Reset RoleContext state (state and todo) via StateManager
    // Note: RoleContext state is managed by StateManager, not directly modified here
  }
}

export default BaseRole;

