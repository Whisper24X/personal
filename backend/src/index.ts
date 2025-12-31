/**
 * Mind2Build Backend
 * Main exports for programmatic API
 */

export * from './core';
export * from './roles';
export * from './actions';
export * from './providers';
// export * from './orchestration'; // Conflicts with roles/ProjectManager
export { Environment, Team } from './orchestration';
export { ProjectManager as OrchestrationProjectManager } from './orchestration/ProjectManager';
export * from './utils';
export * from './types';

