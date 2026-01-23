/**
 * AI Agent Roles
 * Exports all role implementations and role registry
 */

import { Context } from '../core/context/Context';

// Export Role base class
export { Role } from './Role';

// Export all role implementations
export { Salesperson } from './Salesperson';
export { ProductManager } from './ProductManager';
export { Architect } from './Architect';
export { Engineer } from './Engineer';
export { QAEngineer } from './QAEngineer';
export { AutomationEngineer } from './AutomationEngineer';
export { DataAnalyst } from './DataAnalyst';
export { TeamLeader } from './TeamLeader';
export { ProjectManager } from './ProjectManager';

// Import for registry
import { Role } from './Role';
import { Salesperson } from './Salesperson';
import { ProductManager } from './ProductManager';
import { Architect } from './Architect';
import { Engineer } from './Engineer';
import { QAEngineer } from './QAEngineer';
import { AutomationEngineer } from './AutomationEngineer';
import { DataAnalyst } from './DataAnalyst';
import { TeamLeader } from './TeamLeader';
import { ProjectManager } from './ProjectManager';

/**
 * Role Registry - Central registry for all role classes
 * When adding a new role:
 * 1. Create the role file (e.g., NewRole.ts)
 * 2. Add export above
 * 3. Add to this registry
 * 4. Run database migration to add role definition
 */
export const ROLE_REGISTRY: Record<string, new (context: Context, name?: string) => Role> = {
  Salesperson,
  ProductManager,
  Architect,
  ProjectManager,
  Engineer,
  QAEngineer,
  AutomationEngineer,
  TeamLeader,
  DataAnalyst,
};
