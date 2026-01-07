/**
 * Section Conversation Repository
 * Data access layer for section conversation history
 */

import { query } from '../client';
import { logger } from '../../utils';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SectionConversation {
  id: string;
  project_id: string;
  document_id?: string;
  section_number: number;
  document_type: string;
  application_id?: string;
  version: number;
  messages: ConversationMessage[];
  created_at: Date;
  updated_at: Date;
}

export class SectionConversationRepository {
  /**
   * Find or create conversation history for a section
   */
  async findOrCreate(data: {
    projectId: string;
    sectionNumber: number;
    documentType: 'PRD' | 'MRD' | 'DESIGN';
    documentId?: string;
    applicationId?: string;
    version?: number;
  }): Promise<SectionConversation> {
    try {
      const version = data.version || 1;
      
      // Try to find existing conversation
      const existing = await this.findBySection(
        data.projectId,
        data.sectionNumber,
        data.documentType,
        version
      );
      
      if (existing) {
        return existing;
      }
      
      // Create new conversation
      const result = await query<SectionConversation>(
        `INSERT INTO section_conversations (
          project_id, document_id, section_number, document_type, 
          application_id, version, messages
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          data.projectId,
          data.documentId || null,
          data.sectionNumber,
          data.documentType,
          data.applicationId || null,
          version,
          JSON.stringify([]),
        ]
      );
      
      if (!result.rows[0]) {
        throw new Error('Failed to create section conversation: no row returned');
      }
      
      logger.info('Created new section conversation', {
        projectId: data.projectId,
        sectionNumber: data.sectionNumber,
        documentType: data.documentType,
      });
      
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to find or create section conversation:', {
        projectId: data.projectId,
        sectionNumber: data.sectionNumber,
        documentType: data.documentType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find conversation by section
   */
  async findBySection(
    projectId: string,
    sectionNumber: number,
    documentType: 'PRD' | 'MRD' | 'DESIGN',
    version: number = 1
  ): Promise<SectionConversation | null> {
    try {
      const result = await query<SectionConversation>(
        `SELECT * FROM section_conversations 
         WHERE project_id = $1 
           AND section_number = $2 
           AND document_type = $3 
           AND version = $4
         LIMIT 1`,
        [projectId, sectionNumber, documentType, version]
      );
      
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('Failed to find section conversation:', {
        projectId,
        sectionNumber,
        documentType,
        version,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    projectId: string,
    sectionNumber: number,
    documentType: 'PRD' | 'MRD' | 'DESIGN',
    role: 'user' | 'assistant',
    content: string,
    version: number = 1
  ): Promise<SectionConversation> {
    try {
      // Get or create conversation
      const conversation = await this.findOrCreate({
        projectId,
        sectionNumber,
        documentType,
        version,
      });
      
      // Add new message
      const newMessage: ConversationMessage = {
        role,
        content,
        timestamp: new Date().toISOString(),
      };
      
      const updatedMessages = [...conversation.messages, newMessage];
      
      // Update conversation
      const result = await query<SectionConversation>(
        `UPDATE section_conversations 
         SET messages = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(updatedMessages), conversation.id]
      );
      
      if (!result.rows[0]) {
        throw new Error('Failed to update section conversation: no row returned');
      }
      
      logger.info('Added message to section conversation', {
        projectId,
        sectionNumber,
        documentType,
        role,
        messageLength: content.length,
      });
      
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to add message to section conversation:', {
        projectId,
        sectionNumber,
        documentType,
        role,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update conversation messages
   */
  async updateMessages(
    conversationId: string,
    messages: ConversationMessage[]
  ): Promise<SectionConversation> {
    try {
      const result = await query<SectionConversation>(
        `UPDATE section_conversations 
         SET messages = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(messages), conversationId]
      );
      
      if (!result.rows[0]) {
        throw new Error('Failed to update section conversation: no row returned');
      }
      
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to update section conversation messages:', {
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  async clearConversation(
    projectId: string,
    sectionNumber: number,
    documentType: 'PRD' | 'MRD' | 'DESIGN',
    version: number = 1
  ): Promise<void> {
    try {
      await query(
        `UPDATE section_conversations 
         SET messages = $1, updated_at = NOW()
         WHERE project_id = $2 
           AND section_number = $3 
           AND document_type = $4 
           AND version = $5`,
        [JSON.stringify([]), projectId, sectionNumber, documentType, version]
      );
      
      logger.info('Cleared section conversation', {
        projectId,
        sectionNumber,
        documentType,
        version,
      });
    } catch (error: any) {
      logger.error('Failed to clear section conversation:', {
        projectId,
        sectionNumber,
        documentType,
        version,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(
    projectId: string,
    sectionNumber: number,
    documentType: 'PRD' | 'MRD' | 'DESIGN',
    version: number = 1
  ): Promise<void> {
    try {
      await query(
        `DELETE FROM section_conversations 
         WHERE project_id = $1 
           AND section_number = $2 
           AND document_type = $3 
           AND version = $4`,
        [projectId, sectionNumber, documentType, version]
      );
      
      logger.info('Deleted section conversation', {
        projectId,
        sectionNumber,
        documentType,
        version,
      });
    } catch (error: any) {
      logger.error('Failed to delete section conversation:', {
        projectId,
        sectionNumber,
        documentType,
        version,
        error: error.message,
      });
      throw error;
    }
  }
}

