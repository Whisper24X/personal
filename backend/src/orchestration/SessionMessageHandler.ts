/**
 * Session Message Handler
 * Handles message sending and queue management for interactive sessions
 */

import { WebSocket } from 'ws';
import { logger } from '../utils';

export interface MessageQueueItem {
    type: string;
    data: any;
    timestamp: number;
    id: string;
}

export class SessionMessageHandler {
    private ws: WebSocket | null = null;
    private messageQueue: MessageQueueItem[] = [];

    /**
     * Set WebSocket connection
     */
    setWebSocket(ws: WebSocket): void {
        this.ws = ws;
        logger.info(`SessionMessageHandler: WebSocket connected`);
    }

    /**
     * Send message to client via WebSocket or add to queue for polling
     */
    sendMessage(type: string, data: any): void {
        // Add message to queue for polling
        const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const queueItem: MessageQueueItem = {
            type,
            data,
            timestamp: Date.now(),
            id: messageId,
        };
        this.messageQueue.push(queueItem);

        // Keep only last 100 messages to prevent memory issues
        if (this.messageQueue.length > 100) {
            this.messageQueue.shift();
        }

        // Also send via WebSocket if available (for backward compatibility)
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ type, data }));
            } catch (error: any) {
                logger.error(`SessionMessageHandler: Error sending message via WebSocket`, error);
            }
        }
    }

    /**
     * Get messages since last poll (for polling mechanism)
     */
    getMessagesSince(lastMessageId: string | null = null): MessageQueueItem[] {
        if (!lastMessageId) {
            // Return all messages if no last message ID provided
            return [...this.messageQueue];
        }

        // Find the index of the last polled message
        const lastIndex = this.messageQueue.findIndex(msg => msg.id === lastMessageId);
        if (lastIndex === -1) {
            // Last message not found, return all messages
            return [...this.messageQueue];
        }

        // Return messages after the last polled one
        return this.messageQueue.slice(lastIndex + 1);
    }

    /**
     * Get all pending messages and clear them (alternative polling method)
     */
    getAndClearMessages(): MessageQueueItem[] {
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        return messages;
    }

    /**
     * Get message queue length
     */
    getMessageQueueLength(): number {
        return this.messageQueue.length;
    }

    /**
     * Clean up WebSocket connection
     */
    cleanup(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        logger.info(`SessionMessageHandler: Cleaned up`);
    }
}

