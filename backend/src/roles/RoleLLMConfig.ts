/**
 * Role LLM Configuration Manager
 * Handles loading and managing LLM configurations for roles
 */

import { ILLMConfig } from '@mind2build/shared';
import { Context } from '../core/context/Context';
import { BaseAction } from '../core/base/BaseAction';
import { logger } from '../utils';
import { createLLM } from '../providers/llm/factory';
import { RoleLLMConfigRepository, LLMConfigRepository } from '../database';

export class RoleLLMConfig {
    private roleLLM?: any;
    private roleLLMConfigRepo = new RoleLLMConfigRepository();
    private llmConfigRepo = new LLMConfigRepository();
    protected llmLoadPromise?: Promise<void>;

    constructor(
        private profile: string,
        private context: Context,
        private actions: BaseAction[] = []
    ) { }

    /**
     * Initialize LLM with explicit config (fallback)
     */
    initializeWithConfig(config: ILLMConfig | undefined): void {
        if (config) {
            this.roleLLM = createLLM(config);
            this.roleLLM.costManager = this.context.costManager;
            logger.info(
                `${this.profile} using explicitly configured LLM (may be overridden by database config): ${config.provider}/${config.model}`
            );
        }
    }

    /**
     * Start loading LLM configuration from database
     */
    startLoadingFromDatabase(): Promise<void> {
        this.llmLoadPromise = this.loadRoleLLMFromDatabase();
        return this.llmLoadPromise;
    }

    /**
     * Get the current LLM instance
     */
    getLLM(): any {
        return this.roleLLM;
    }

    /**
     * Update actions with current LLM
     */
    updateActionsLLM(actions: BaseAction[]): void {
        if (this.roleLLM && actions.length > 0) {
            actions.forEach((action) => action.setLLM(this.roleLLM));
            logger.info(`${this.profile} updated actions with LLM config`);
        }
    }

    /**
     * Load role-specific LLM configuration from database
     * Priority: database config (role-specific) > explicit config.llm > active LLM config from database
     */
    private async loadRoleLLMFromDatabase(): Promise<void> {
        try {
            const userId = this.context.get('userId') || '302769d6-247d-43db-a005-0519712255fb';

            // Try role-specific config first
            const dbConfig = await this.roleLLMConfigRepo.findByProfile(userId, this.profile);

            if (dbConfig) {
                const llmConfig: ILLMConfig = {
                    provider: dbConfig.provider,
                    apiKey: dbConfig.api_key || '',
                    baseURL: dbConfig.base_url || undefined,
                    model: dbConfig.model,
                    temperature: dbConfig.temperature !== null ? dbConfig.temperature : undefined,
                    maxTokens: dbConfig.max_tokens !== null ? dbConfig.max_tokens : undefined,
                    repository: dbConfig.repository || undefined,
                    branchName: dbConfig.branch_name || undefined,
                    autoCreatePr: dbConfig.auto_create_pr,
                };

                this.roleLLM = createLLM(llmConfig);
                this.roleLLM.costManager = this.context.costManager;

                if (this.actions.length > 0) {
                    this.updateActionsLLM(this.actions);
                    logger.info(
                        `${this.profile} updated actions with database LLM config: ${dbConfig.provider}/${dbConfig.model}`
                    );
                } else {
                    logger.info(
                        `${this.profile} loaded LLM config from database (highest priority): ${dbConfig.provider}/${dbConfig.model}`
                    );
                }
                return;
            }

            // Fallback to active LLM config
            try {
                const activeConfig = await this.llmConfigRepo.findActive(userId);
                if (activeConfig) {
                    const llmConfig = this.llmConfigRepo.toILLMConfig(activeConfig);
                    this.roleLLM = createLLM(llmConfig);
                    this.roleLLM.costManager = this.context.costManager;

                    if (this.actions.length > 0) {
                        this.updateActionsLLM(this.actions);
                        logger.info(
                            `${this.profile} updated actions with active LLM config from database: ${llmConfig.provider}/${llmConfig.model}`
                        );
                    } else {
                        logger.info(
                            `${this.profile} using active LLM config from database: ${llmConfig.provider}/${llmConfig.model}`
                        );
                    }
                    return;
                }
            } catch (activeConfigError: any) {
                logger.debug(
                    `${this.profile} error loading active LLM config from database:`,
                    activeConfigError.message
                );
            }

            // No database config found
            if (!this.roleLLM) {
                const defaultConfig = this.context.config.llm;
                logger.warn(
                    `${this.profile} no role-specific or active LLM config found, using system default: ${defaultConfig.provider}/${defaultConfig.model}`
                );
            } else {
                logger.debug(`${this.profile} no database LLM config found, using explicit config.llm`);
            }
        } catch (error: any) {
            logger.debug(`${this.profile} error loading LLM config from database:`, error.message);
            if (!this.roleLLM) {
                const defaultConfig = this.context.config.llm;
                logger.info(
                    `${this.profile} will use system default LLM config due to database error: ${defaultConfig.provider}/${defaultConfig.model}`
                );
            }
        }
    }
}

