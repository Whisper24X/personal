/**
 * Session State Restorer
 * Restores message history and state from database
 */

import { Environment } from './Environment';
import { logger } from '../utils';

export class SessionStateRestorer {
    /**
     * Restore message history from database
     */
    static async restoreMessageHistory(
        projectId: string,
        env: Environment,
        initialIdea: string
    ): Promise<void> {
        try {
            const { MessageRepository } = await import('../database/repositories/MessageRepository');
            const messageRepo = new MessageRepository();
            const dbMessages = await messageRepo.findByProjectId(projectId, 1000);

            logger.info(`SessionStateRestorer: Checking messages for project ${projectId}, found ${dbMessages.length} messages in database`);

            if (dbMessages.length > 0) {
                logger.info(`SessionStateRestorer: Found ${dbMessages.length} messages in database for project ${projectId}, restoring message history`);
                // Log message details for debugging
                dbMessages.forEach((msg, idx) => {
                    logger.debug(`SessionStateRestorer: Message ${idx + 1}/${dbMessages.length}: role=${msg.role_type}, causeBy=${msg.cause_by}, id=${msg.message_uuid}`);
                });

                // Restore messages to environment
                const { Message } = await import('../core/message/Message');
                const { MESSAGE_ROUTE_TO_ALL } = await import('@mind2build/shared');

                for (const dbMsg of dbMessages) {
                    try {
                        // Ensure sendTo is properly set - if empty, use broadcast
                        let sendTo = Array.isArray(dbMsg.send_to) ? dbMsg.send_to : [];
                        if (sendTo.length === 0) {
                            // If sendTo is empty, use broadcast to ensure message reaches all roles
                            // This is safe because roles will filter via watch mechanism
                            sendTo = [MESSAGE_ROUTE_TO_ALL];
                        }

                        // Use fromJSON to properly restore message with original ID
                        const restoredMessage = Message.fromJSON({
                            id: dbMsg.message_uuid,
                            content: dbMsg.content,
                            role: dbMsg.role_type,
                            causeBy: dbMsg.cause_by,
                            sentFrom: dbMsg.sent_from,
                            sendTo: sendTo,
                            instructContent: dbMsg.instruct_content,
                            metadata: dbMsg.metadata || {},
                        });

                        const published = env.publishMessage(restoredMessage);
                        logger.info(`SessionStateRestorer: Restored message ${dbMsg.message_uuid} - role: ${dbMsg.role_type}, causeBy: ${dbMsg.cause_by}, published: ${published}, sendTo: [${sendTo.join(', ')}]`);
                    } catch (error: any) {
                        logger.warn(`SessionStateRestorer: Failed to restore message ${dbMsg.message_uuid}`, {
                            error: error.message,
                            stack: error.stack,
                        });
                    }
                }

                logger.info(`SessionStateRestorer: Successfully restored ${dbMessages.length} messages to environment`);

                // After restoring messages, check if we need to restore messages for completed actions
                // that roles are watching for
                await this.restoreMissingMessages(projectId, env);
            } else {
                logger.info(`SessionStateRestorer: No messages found in database for project ${projectId}, will publish initial message`);

                // Publish initial user requirement message if no messages found
                await this.publishInitialMessage(projectId, env, initialIdea);
            }
        } catch (error: any) {
            logger.warn(`SessionStateRestorer: Failed to restore message history for project ${projectId}`, {
                error: error.message,
            });

            // Fallback: publish initial message
            await this.publishInitialMessage(projectId, env, initialIdea);
        }
    }

    /**
     * Restore missing messages for completed actions
     */
    private static async restoreMissingMessages(projectId: string, env: Environment): Promise<void> {
        try {
            const { InteractiveSessionWorkflowRepository } = await import('../database/repositories/InteractiveSessionWorkflowRepository');
            const workflowRepo = new InteractiveSessionWorkflowRepository();
            const workflowItems = await workflowRepo.getWorkflowItems(projectId);

            const completedActions = new Set<string>();
            workflowItems.forEach(item => {
                if (item.status === 'completed' && item.action) {
                    completedActions.add(item.action);
                }
            });

            // Check which completed actions have messages in environment history
            const envHistoryCauseBys = new Set(env.history.map(msg => msg.causeBy));
            const missingActions = Array.from(completedActions).filter(action => !envHistoryCauseBys.has(action));

            if (missingActions.length > 0) {
                logger.info(`SessionStateRestorer: Found ${missingActions.length} completed actions without messages in environment: [${missingActions.join(', ')}]`);
                logger.info(`SessionStateRestorer: Attempting to restore missing messages from database...`);

                // Try to restore missing messages from database
                const { MessageRepository } = await import('../database/repositories/MessageRepository');
                const messageRepo = new MessageRepository();
                const allDbMessages = await messageRepo.findByProjectId(projectId, 1000);

                // Find messages for missing actions
                const missingMessages = allDbMessages.filter(dbMsg =>
                    missingActions.includes(dbMsg.cause_by) &&
                    !env.history.some(msg => msg.id === dbMsg.message_uuid)
                );

                if (missingMessages.length > 0) {
                    logger.info(`SessionStateRestorer: Found ${missingMessages.length} missing messages in database, restoring...`);
                    const { Message } = await import('../core/message/Message');
                    const { MESSAGE_ROUTE_TO_ALL } = await import('@mind2build/shared');

                    for (const dbMsg of missingMessages) {
                        try {
                            let sendTo = Array.isArray(dbMsg.send_to) ? dbMsg.send_to : [];
                            if (sendTo.length === 0) {
                                sendTo = [MESSAGE_ROUTE_TO_ALL];
                            }

                            const restoredMessage = Message.fromJSON({
                                id: dbMsg.message_uuid,
                                content: dbMsg.content,
                                role: dbMsg.role_type,
                                causeBy: dbMsg.cause_by,
                                sentFrom: dbMsg.sent_from,
                                sendTo: sendTo,
                                instructContent: dbMsg.instruct_content,
                                metadata: dbMsg.metadata || {},
                            });

                            const published = env.publishMessage(restoredMessage);
                            logger.info(`SessionStateRestorer: Restored missing message ${dbMsg.message_uuid} - role: ${dbMsg.role_type}, causeBy: ${dbMsg.cause_by}, published: ${published}`);
                        } catch (error: any) {
                            logger.warn(`SessionStateRestorer: Failed to restore missing message ${dbMsg.message_uuid}`, {
                                error: error.message,
                            });
                        }
                    }
                    logger.info(`SessionStateRestorer: Successfully restored ${missingMessages.length} missing messages`);
                } else {
                    logger.warn(`SessionStateRestorer: Missing actions [${missingActions.join(', ')}] are marked as completed but no messages found in database`);
                }
            }
        } catch (error: any) {
            logger.warn(`SessionStateRestorer: Failed to check and restore missing messages`, {
                error: error.message,
            });
        }
    }

    /**
     * Publish initial message
     */
    private static async publishInitialMessage(
        projectId: string,
        env: Environment,
        initialIdea: string
    ): Promise<void> {
        const { Message } = await import('../core/message/Message');
        const initialMessage = new Message({
            content: initialIdea,
            role: 'user',
            causeBy: 'User',
            sentFrom: 'User',
        });
        env.publishMessage(initialMessage);
        logger.info(`SessionStateRestorer: Published initial requirement: ${initialIdea.substring(0, 100)}...`);

        // Save initial message to database
        try {
            const { MessageRepository } = await import('../database/repositories/MessageRepository');
            const messageRepo = new MessageRepository();
            await messageRepo.save(projectId, initialMessage);
            logger.info(`SessionStateRestorer: Saved initial message ${initialMessage.id} to database for project ${projectId}`);
        } catch (error: any) {
            logger.warn(`SessionStateRestorer: Failed to save initial message to database`, {
                error: error.message,
                projectId: projectId,
            });
        }
    }
}

