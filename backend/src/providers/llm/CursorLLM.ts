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

    // Normalize repository format - convert to full GitHub URL
    this.repository = this.normalizeRepository(config.repository);

    // Validate repository format (should be full GitHub URL)
    const githubUrlPattern = /^https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/i;
    if (!githubUrlPattern.test(this.repository)) {
      throw new Error(`CursorLLM: Invalid repository format. Expected GitHub URL (e.g., https://github.com/owner/repo), got: ${config.repository}`);
    }

    // Validate and sanitize branch name
    let branchName = config.branchName || `cursor/${Date.now()}`;
    // Remove invalid characters from branch name (Git branch name rules)
    branchName = branchName.replace(/[^a-zA-Z0-9/._-]/g, '-');
    // Ensure it doesn't start with a slash
    branchName = branchName.replace(/^\/+/, '');
    this.branchName = branchName;

    this.autoCreatePr = config.autoCreatePr ?? true;

    logger.info('CursorLLM: Initializing', {
      repository: this.repository,
      branchName: this.branchName,
      autoCreatePr: this.autoCreatePr,
      model: config.model,
    });
  }

  /**
   * Normalize repository format to full GitHub URL
   * According to Cursor API docs, repository should be full GitHub URL
   * Examples:
   *   "https://github.com/owner/repo" -> "https://github.com/owner/repo"
   *   "https://github.com/owner/repo.git" -> "https://github.com/owner/repo"
   *   "git@github.com:owner/repo.git" -> "https://github.com/owner/repo"
   *   "owner/repo" -> "https://github.com/owner/repo"
   */
  private normalizeRepository(repo: string): string {
    // If already a full GitHub URL, normalize it (remove .git if present)
    const githubUrlPattern = /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?\/?$/i;
    const urlMatch = repo.match(githubUrlPattern);
    if (urlMatch && urlMatch[1] && urlMatch[2]) {
      const normalized = `https://github.com/${urlMatch[1]}/${urlMatch[2]}`;
      if (normalized !== repo) {
        logger.debug('CursorLLM: Normalized repository URL', {
          original: repo,
          normalized,
        });
      }
      return normalized;
    }

    // If it's git@github.com format, convert to HTTPS URL
    const gitSshPattern = /^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?$/i;
    const sshMatch = repo.match(gitSshPattern);
    if (sshMatch && sshMatch[1] && sshMatch[2]) {
      const normalized = `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
      logger.debug('CursorLLM: Converted SSH URL to HTTPS', {
        original: repo,
        normalized,
      });
      return normalized;
    }

    // If it's "owner/repo" format, convert to full GitHub URL
    const repoPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (repoPattern.test(repo)) {
      const normalized = `https://github.com/${repo}`;
      logger.debug('CursorLLM: Converted owner/repo to full URL', {
        original: repo,
        normalized,
      });
      return normalized;
    }

    // If no pattern matches, return original (will fail validation)
    logger.warn('CursorLLM: Could not normalize repository format', { repo });
    return repo;
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
        repository: this.repository,
        branchName: this.branchName,
        model: this.config.model,
      });

      // Create or reuse agent
      let agentId = this.currentAgentId;

      if (!agentId) {
        // Create new agent
        // Note: According to Cursor API, 'name' field is not required in the request
        const createRequest: CreateAgentRequest = {
          prompt: {
            text: fullPrompt,
          },
          source: {
            repository: this.repository,
            ref: 'main', // Default to main branch
          },
          target: {
            branchName: this.branchName,
            autoCreatePr: this.autoCreatePr ?? true,
            openAsCursorGithubApp: false,
            skipReviewerRequest: false,
          },
          // Only include model if it's not 'auto' (API may not accept 'auto' as model value)
          model: this.config.model && this.config.model !== 'auto' ? this.config.model : undefined,
        };

        logger.debug('CursorLLM: Creating agent with request', {
          repository: createRequest.source.repository,
          ref: createRequest.source.ref,
          branchName: createRequest.target?.branchName,
          autoCreatePr: createRequest.target?.autoCreatePr,
          model: createRequest.model,
          promptLength: createRequest.prompt.text.length,
        });

        try {
          const createResponse = await cursorAgentClient.createAgent(createRequest);
          agentId = createResponse.id;
          this.currentAgentId = agentId;

          logger.info('CursorLLM: Agent created', { agentId });
        } catch (createError: any) {
          // Extract safe error information without circular references
          const errorMessage = createError?.message || String(createError);
          logger.error('CursorLLM: Failed to create agent', {
            error: errorMessage,
            statusCode: createError?.statusCode,
            statusText: createError?.statusText,
            responseData: createError?.responseData,
            request: {
              repository: createRequest.source.repository,
              ref: createRequest.source.ref,
              branchName: createRequest.target?.branchName,
              model: createRequest.model,
            },
          });
          throw createError;
        }
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
      const statusCode = error.response?.status || error.statusCode;
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || errorData?.error || error.message || 'Unknown error';

      logger.error('CursorLLM: Completion failed', {
        error: errorMessage,
        statusCode,
        statusText: error.response?.statusText,
        errorData,
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        repository: this.repository,
        branchName: this.branchName,
      });

      // Provide more helpful error messages based on status code
      let finalErrorMessage = `Cursor Agent API error: ${errorMessage}`;
      if (statusCode === 400) {
        finalErrorMessage = `Cursor Agent API validation error (400): ${errorMessage}. ` +
          `Please check: repository format (should be "owner/repo"), branch name format, and API key permissions. ` +
          `Repository: ${this.repository}, Branch: ${this.branchName}`;
      } else if (statusCode === 401) {
        finalErrorMessage = `Cursor Agent API authentication error (401): Invalid API key. Please check your CURSOR_API_KEY.`;
      } else if (statusCode === 404) {
        finalErrorMessage = `Cursor Agent API not found error (404): ${errorMessage}. ` +
          `Repository may not exist or API endpoint may have changed.`;
      } else if (statusCode === 429) {
        finalErrorMessage = `Cursor Agent API rate limit error (429): ${errorMessage}. Please try again later.`;
      }

      throw new LLMAPIError(finalErrorMessage, statusCode);
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

