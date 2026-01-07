/**
 * Section Conversation History Manager
 * 管理章节对话历史的工具（使用数据库存储）
 */

import { logger } from './index';
import { SectionConversationRepository, type ConversationMessage, type SectionConversation } from '../database/repositories/SectionConversationRepository';

export interface SectionConversationHistory {
  sectionNumber: number;
  messages: ConversationMessage[];
  lastUpdated: string;
}

// Create repository instance
const conversationRepo = new SectionConversationRepository();

/**
 * 加载章节对话历史（从数据库）
 */
export async function loadSectionConversationHistory(
  projectId: string,
  sectionNumber: number,
  documentType: 'PRD' | 'MRD' | 'DESIGN' = 'PRD',
  version: number = 1
): Promise<SectionConversationHistory | null> {
  try {
    const conversation = await conversationRepo.findBySection(
      projectId,
      sectionNumber,
      documentType,
      version
    );
    
    if (!conversation) {
      return null;
    }
    
    return {
      sectionNumber: conversation.section_number,
      messages: conversation.messages,
      lastUpdated: conversation.updated_at.toISOString(),
    };
  } catch (error: any) {
    logger.error('SectionConversationHistory: Failed to load history from database', {
      error: error.message,
      projectId,
      sectionNumber,
      documentType,
      version,
    });
    return null;
  }
}

/**
 * 保存章节对话历史（到数据库）
 */
export async function saveSectionConversationHistory(
  projectId: string,
  sectionNumber: number,
  documentType: 'PRD' | 'MRD' | 'DESIGN',
  history: SectionConversationHistory,
  documentId?: string,
  applicationId?: string,
  version: number = 1
): Promise<void> {
  try {
    const conversation = await conversationRepo.findOrCreate({
      projectId,
      sectionNumber,
      documentType,
      documentId,
      applicationId,
      version,
    });
    
    await conversationRepo.updateMessages(conversation.id, history.messages);
    
    logger.info('SectionConversationHistory: Saved conversation history to database', {
      projectId,
      sectionNumber,
      documentType,
      messageCount: history.messages.length,
    });
  } catch (error: any) {
    logger.error('SectionConversationHistory: Failed to save history to database', {
      error: error.message,
      projectId,
      sectionNumber,
      documentType,
    });
    throw error;
  }
}

/**
 * 添加消息到对话历史（数据库）
 */
export async function addMessageToSectionConversation(
  projectId: string,
  sectionNumber: number,
  documentType: 'PRD' | 'MRD' | 'DESIGN',
  role: 'user' | 'assistant',
  content: string,
  version: number = 1
): Promise<SectionConversationHistory> {
  try {
    const conversation = await conversationRepo.addMessage(
      projectId,
      sectionNumber,
      documentType,
      role,
      content,
      version
    );
    
    return {
      sectionNumber: conversation.section_number,
      messages: conversation.messages,
      lastUpdated: conversation.updated_at.toISOString(),
    };
  } catch (error: any) {
    logger.error('SectionConversationHistory: Failed to add message', {
      error: error.message,
      projectId,
      sectionNumber,
      documentType,
      role,
    });
    throw error;
  }
}

/**
 * 获取对话历史的文本表示（用于 prompt）
 */
export function formatConversationHistoryForPrompt(
  history: SectionConversationHistory | null,
  maxMessages: number = 10
): string {
  if (!history || history.messages.length === 0) {
    return '';
  }
  
  // 只取最近的 N 条消息
  const recentMessages = history.messages.slice(-maxMessages);
  
  const lines = recentMessages.map(msg => {
    const roleLabel = msg.role === 'user' ? '用户' : 'AI助手';
    return `【${roleLabel}】${msg.content}`;
  });
  
  return `\n\n【之前的对话历史（最近 ${recentMessages.length} 条）】\n${lines.join('\n\n')}`;
}

/**
 * 清空章节对话历史（数据库）
 */
export async function clearSectionConversationHistory(
  projectId: string,
  sectionNumber: number,
  documentType: 'PRD' | 'MRD' | 'DESIGN' = 'PRD',
  version: number = 1
): Promise<void> {
  try {
    await conversationRepo.clearConversation(
      projectId,
      sectionNumber,
      documentType,
      version
    );
    
    logger.info('SectionConversationHistory: Cleared conversation history from database', {
      projectId,
      sectionNumber,
      documentType,
      version,
    });
  } catch (error: any) {
    logger.error('SectionConversationHistory: Failed to clear history from database', {
      error: error.message,
      projectId,
      sectionNumber,
      documentType,
      version,
    });
    throw error;
  }
}

