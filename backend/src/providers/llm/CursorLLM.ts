/**
 * Cursor Agent LLM Provider
 * Wraps Cursor Cloud Agent API as an LLM provider
 * Uses Cursor Agent API to create agents and get responses
 */

import { ILLMConfig, ILLMResponse, ILLMUsage, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { cursorAgentClient, CreateAgentRequest } from '../../utils/CursorAgentClient';
import { logger } from '../../utils';

export class CursorLLM extends BaseLLM {
  private currentAgentId: string | null = null;
  private repository: string;
  private branchName: string;
  private autoCreatePr: boolean;

  constructor(config: ILLMConfig) {
    super(config);

    // Validate required Cursor-specific config
    if (!config.repository) {
      throw new Error('CursorLLM: repository is required in config');
    }

    this.repository = config.repository;
    this.branchName = config.branchName || `cursor/${Date.now()}`;
    this.autoCreatePr = config.autoCreatePr ?? true;

    logger.info('CursorLLM: Initializing', {
      repository: this.repository,
      branchName: this.branchName,
      autoCreatePr: this.autoCreatePr,
    });
  }

  /**
   * Chat completion using Cursor Agent API
   * Creates an agent, sends prompt, waits for completion, and returns result
   */
  async acompletion(messages: any[]): Promise<ILLMResponse> {
    const startTime = Date.now();

    try {
      // Extract prompt from messages
      const userMessage = messages.find(m => m.role === 'user');
      const systemMessages = messages.filter(m => m.role === 'system');
      
      if (!userMessage) {
        throw new Error('CursorLLM: No user message found in messages');
      }

      const promptText = userMessage.content;
      const systemPrompt = systemMessages.length > 0 
        ? systemMessages.map(m => m.content).join('\n\n')
        : undefined;

      // Combine system prompt with user prompt if system prompt exists
      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\n${promptText}`
        : promptText;

      logger.info('CursorLLM: Starting agent creation', {
        promptLength: fullPrompt.length,
        hasSystemPrompt: !!systemPrompt,
      });

      // Create or reuse agent
      let agentId = this.currentAgentId;
      
      if (!agentId) {
        // Create new agent
        const createRequest: CreateAgentRequest = {
          name: `Code Generation - ${new Date().toISOString()}`,
          prompt: {
            text: fullPrompt,
          },
          source: {
            repository: this.repository,
            ref: 'main', // Default to main branch
          },
          target: {
            branchName: this.branchName,
            autoCreatePr: this.autoCreatePr,
            openAsCursorGithubApp: false,
            skipReviewerRequest: false,
          },
          model: this.config.model || undefined, // Use model from config if specified
        };

        const createResponse = await cursorAgentClient.createAgent(createRequest);
        agentId = createResponse.id;
        this.currentAgentId = agentId;

        logger.info('CursorLLM: Agent created', { agentId });
      } else {
        // Send followup to existing agent
        logger.info('CursorLLM: Sending followup to existing agent', { agentId });
        await cursorAgentClient.sendFollowup(agentId, {
          prompt: {
            text: fullPrompt,
          },
        });
      }

      // Wait for agent to complete
      const result = await this.waitForAgentCompletion(agentId);

      // Get conversation to extract response
      const conversation = await cursorAgentClient.getAgentConversation(agentId);
      
      // Extract the last assistant message as the response
      const assistantMessages = conversation.messages
        .filter(m => m.type === 'assistant_message')
        .reverse();
      
      const responseText = assistantMessages.length > 0
        ? assistantMessages[0].text
        : 'Agent completed but no response message found';

      const elapsedTime = Date.now() - startTime;
      logger.info('CursorLLM: Agent completed', {
        agentId,
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        responseLength: responseText.length,
        status: result.status,
      });

      // Create LLM response
      // Note: Cursor Agent API doesn't provide token usage, so we estimate
      const estimatedUsage: ILLMUsage = {
        promptTokens: Math.ceil(fullPrompt.length / 4), // Rough estimate: 4 chars per token
        completionTokens: Math.ceil(responseText.length / 4),
        totalTokens: Math.ceil((fullPrompt.length + responseText.length) / 4),
      };

      const llmResponse: ILLMResponse = {
        content: responseText,
        usage: estimatedUsage,
        model: this.config.model || 'cursor-agent',
      };

      // Update cost tracking
      this.updateCost(llmResponse.usage);
      this.logCall(messages, llmResponse);

      return llmResponse;
    } catch (error: any) {
      const elapsedTime = Date.now() - startTime;
      logger.error('CursorLLM: Completion failed', {
        error: error.message,
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
      });

      throw new LLMAPIError(
        `Cursor Agent API error: ${error.message}`,
        error.statusCode
      );
    }
  }

  /**
   * Wait for agent to complete (polling)
   */
  private async waitForAgentCompletion(agentId: string, maxWaitTime: number = 600000): Promise<{ status: string }> {
    const startTime = Date.now();
    const pollInterval = 5000; // Poll every 5 seconds
    const maxPolls = Math.floor(maxWaitTime / pollInterval);

    logger.info('CursorLLM: Waiting for agent completion', {
      agentId,
      maxWaitTime,
      maxPolls,
    });

    for (let i = 0; i < maxPolls; i++) {
      const agent = await cursorAgentClient.getAgent(agentId);
      
      if (agent.status === 'FINISHED' || agent.status === 'FAILED' || agent.status === 'STOPPED') {
        logger.info('CursorLLM: Agent finished', {
          agentId,
          status: agent.status,
          elapsedTime: Date.now() - startTime,
        });
        return { status: agent.status };
      }

      // Wait before next poll
      if (i < maxPolls - 1) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    // Timeout
    throw new Error(`CursorLLM: Agent did not complete within ${maxWaitTime / 1000}s`);
  }

  /**
   * Clean up current agent
   */
  async cleanup(): Promise<void> {
    if (this.currentAgentId) {
      try {
        await cursorAgentClient.deleteAgent(this.currentAgentId);
        logger.info('CursorLLM: Agent cleaned up', { agentId: this.currentAgentId });
      } catch (error: any) {
        logger.warn('CursorLLM: Failed to cleanup agent', {
          agentId: this.currentAgentId,
          error: error.message,
        });
      }
      this.currentAgentId = null;
    }
  }
}

export default CursorLLM;

