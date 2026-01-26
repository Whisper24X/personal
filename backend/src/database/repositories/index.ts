/**
 * Database repositories
 * Schema V2: Updated exports for new table structure
 */

// Core repositories
export { ProjectRepository } from './ProjectRepository';
export { RoleRepository } from './RoleRepository';
export { MessageRepository } from './MessageRepository';
export { DocumentRepository } from './DocumentRepository';

// Action logs (renamed from actions)
export { ActionLogRepository, ActionLogRepository as ActionRepository } from './ActionLogRepository';

// Configuration repositories
export { LLMConfigRepository } from './LLMConfigRepository';
export { LLMModelRepository } from './LLMModelRepository';
export { PromptConfigRepository } from './PromptConfigRepository';

// Knowledge and conversation repositories
export { KnowledgeBaseRepository } from './KnowledgeBaseRepository';
export { SectionConversationRepository } from './SectionConversationRepository';

// Definition repositories
export { RoleDefinitionRepository } from './RoleDefinitionRepository';
export { ActionDefinitionRepository } from './ActionDefinitionRepository';

// Application and workflow repositories
export { ApplicationRepository } from './ApplicationRepository';
export { ApplicationWorkflowRepository } from './ApplicationWorkflowRepository';

// Project version repository
export { ProjectVersionRepository } from './ProjectVersionRepository';

// Deprecated: These are kept for backward compatibility but redirect to LLMConfigRepository
// export { ProviderConfigRepository } from './ProviderConfigRepository';
// export { RoleLLMConfigRepository } from './RoleLLMConfigRepository';
