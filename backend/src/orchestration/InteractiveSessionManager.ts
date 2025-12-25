/**
 * Interactive Session Manager
 * Manages multiple interactive sessions
 */

import { v4 as uuidv4 } from 'uuid';
import { InteractiveSession, SessionConfig } from './InteractiveSession';
import { logger } from '../utils';

export class InteractiveSessionManager {
    private static instance: InteractiveSessionManager;
    private sessions: Map<string, InteractiveSession> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor() {
        // Start cleanup timer
        this.startCleanupTimer();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): InteractiveSessionManager {
        if (!InteractiveSessionManager.instance) {
            InteractiveSessionManager.instance = new InteractiveSessionManager();
        }
        return InteractiveSessionManager.instance;
    }

    /**
     * Create a new interactive session
     */
    createSession(config: SessionConfig): InteractiveSession {
        const sessionId = uuidv4();
        const session = new InteractiveSession(sessionId, config);

        this.sessions.set(sessionId, session);

        logger.info(`SessionManager: Created session ${sessionId} for project "${config.name}"`);

        return session;
    }

    /**
     * Get a session by ID
     */
    getSession(sessionId: string): InteractiveSession | undefined {
        const session = this.sessions.get(sessionId);

        if (session) {
            session.updateActivity();
        }

        return session;
    }

    /**
     * Remove a session
     */
    removeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);

        if (session) {
            session.cleanup();
            this.sessions.delete(sessionId);
            logger.info(`SessionManager: Removed session ${sessionId}`);
            return true;
        }

        return false;
    }

    /**
     * Get all active sessions
     */
    getAllSessions(): InteractiveSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Get session count
     */
    getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Get sessions for a specific user
     */
    getUserSessions(userId: string): InteractiveSession[] {
        return Array.from(this.sessions.values()).filter(
            s => s.userId === userId
        );
    }

    /**
     * Start cleanup timer for expired sessions
     */
    private startCleanupTimer(): void {
        // Check every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);

        logger.info('SessionManager: Cleanup timer started');
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('SessionManager: Cleanup timer stopped');
        }
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): void {
        const expiredSessions: string[] = [];

        for (const [id, session] of this.sessions.entries()) {
            if (session.isExpired()) {
                expiredSessions.push(id);
            }
        }

        if (expiredSessions.length > 0) {
            logger.info(`SessionManager: Cleaning up ${expiredSessions.length} expired sessions`);

            expiredSessions.forEach(id => {
                this.removeSession(id);
            });
        }
    }

    /**
     * Get manager statistics
     */
    getStats(): {
        totalSessions: number;
        activeSessions: number;
        expiredSessions: number;
    } {
        let expired = 0;

        for (const session of this.sessions.values()) {
            if (session.isExpired()) {
                expired++;
            }
        }

        return {
            totalSessions: this.sessions.size,
            activeSessions: this.sessions.size - expired,
            expiredSessions: expired,
        };
    }

    /**
     * Shutdown manager and cleanup all sessions
     */
    shutdown(): void {
        logger.info(`SessionManager: Shutting down, cleaning up ${this.sessions.size} sessions`);

        this.stopCleanupTimer();

        for (const session of this.sessions.values()) {
            session.cleanup();
        }

        this.sessions.clear();
    }
}

// Export singleton instance
export const sessionManager = InteractiveSessionManager.getInstance();

export default sessionManager;

