/**
 * Workflow Module
 * Unified state management for workflow execution
 * 
 * This module provides a simplified, database-centric state management system
 * that uses a single workflow_executions table for all workflow state.
 * 
 * Key components:
 * - WorkflowExecutionService: Main service for managing workflow state
 * - WorkflowStateMachine: Pure state machine logic for state transitions
 * - WorkflowRecoveryService: Unified recovery for all scenarios
 * - WorkflowExecutionRepository: Database access layer
 * - WorkflowExecutor: Execution engine connecting state and role/action execution
 */

// Types
export * from './types';

// Repository
export { WorkflowExecutionRepository } from './WorkflowExecutionRepository';

// Services
export { WorkflowStateMachine } from './WorkflowStateMachine';
export { WorkflowExecutionService } from './WorkflowExecutionService';
export { WorkflowRecoveryService } from './WorkflowRecoveryService';

// Executor
export { 
  WorkflowExecutor, 
  WorkflowMessageHandler, 
  WorkflowExecutorConfig,
  getWorkflowExecutor,
  clearWorkflowExecutor,
} from './WorkflowExecutor';

// Startup and lifecycle
export {
  initializeWorkflowModule,
  getRecoveryService,
  isWorkflowModuleInitialized,
  shutdownWorkflowModule,
} from './startup';
