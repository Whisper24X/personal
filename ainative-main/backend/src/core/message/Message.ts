/**
 * Message class for inter-agent communication
 * Based on mind2build's message system
 */

import { v4 as uuidv4 } from 'uuid';
import { IMessage, MESSAGE_ROUTE_TO_ALL, anyToStr } from '@mind2build/shared';

export class Message implements IMessage {
  id: string;
  content: string;
  instructContent?: Record<string, any>;
  role: string;
  causeBy: string;
  sentFrom: string;
  sendTo: Set<string>;
  metadata: Record<string, any>;

  constructor(params: {
    content: string;
    role?: string;
    causeBy?: string | Function;
    sentFrom?: string;
    sendTo?: string | Set<string>;
    instructContent?: Record<string, any>;
    metadata?: Record<string, any>;
  }) {
    this.id = uuidv4();
    this.content = params.content;
    this.role = params.role || 'user';
    this.causeBy = params.causeBy ? anyToStr(params.causeBy) : 'User';
    this.sentFrom = params.sentFrom || '';
    this.instructContent = params.instructContent;
    this.metadata = params.metadata || {};

    // Handle sendTo parameter
    if (params.sendTo) {
      if (typeof params.sendTo === 'string') {
        this.sendTo = new Set([params.sendTo]);
      } else {
        this.sendTo = params.sendTo;
      }
    } else {
      this.sendTo = new Set([MESSAGE_ROUTE_TO_ALL]);
    }
  }

  /**
   * Serialize message to JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      content: this.content,
      instructContent: this.instructContent,
      role: this.role,
      causeBy: this.causeBy,
      sentFrom: this.sentFrom,
      sendTo: Array.from(this.sendTo),
      metadata: this.metadata,
    };
  }

  /**
   * Deserialize message from JSON
   */
  static fromJSON(data: any): Message {
    const msg = new Message({
      content: data.content,
      role: data.role,
      causeBy: data.causeBy,
      sentFrom: data.sentFrom,
      instructContent: data.instructContent,
      metadata: data.metadata,
    });
    
    msg.id = data.id;
    msg.sendTo = new Set(data.sendTo);
    
    return msg;
  }

  /**
   * Create a copy of the message
   */
  clone(): Message {
    return Message.fromJSON(this.toJSON());
  }

  /**
   * Check if message is sent to a specific address
   */
  isSentTo(address: string): boolean {
    return this.sendTo.has(MESSAGE_ROUTE_TO_ALL) || this.sendTo.has(address);
  }

  /**
   * Get a string representation of the message
   */
  toString(): string {
    return `Message(id=${this.id}, causeBy=${this.causeBy}, from=${this.sentFrom}, to=${Array.from(this.sendTo).join(',')})`;
  }
}

export default Message;

