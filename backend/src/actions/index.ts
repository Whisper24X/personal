/**
 * Agent Actions
 * Exports all action implementations and action registry
 */

import { BaseAction } from '../core/base/BaseAction';

// Document Writing Actions
export { WriteMRD } from './WriteMRD';
export { WritePRD } from './WritePRD';
export { WriteDesign } from './WriteDesign';
export { WriteCode } from './WriteCode';
export { WriteTest } from './WriteTest';
export { WriteTestPlan } from './WriteTestPlan';
export { GeneratePrototype } from './GeneratePrototype';

// Document Review Actions
export { MRDReview } from './MRDReview';
export { PRDReview } from './PRDReview';
export { DesignReview } from './DesignReview';

// Document Improvement Actions
export { ImprovePRD } from './ImprovePRD';
export { ImproveMRD } from './ImproveMRD';
export { ImproveDesign } from './ImproveDesign';

// Task Management Actions
export { ExecuteSubtask } from './ExecuteSubtask';

// OpenSpec Actions
export { ExecuteProjectManagement } from './ExecuteProjectManagement';

// Code Execution and Bug Fix Actions
export { ImproveCode } from './ImproveCode';
export { Deploy } from './Deploy';

// QA Actions
export { TestReview } from './TestReview';
export { ImproveTest } from './ImproveTest';
export { AutomationPlanning } from './AutomationPlanning';
export { AutomationExecution } from './AutomationExecution';
export { ApiAutomationPlanning } from './ApiAutomationPlanning';
export { ApiAutomationExecution } from './ApiAutomationExecution';
export { CoverageQualityCheck } from './CoverageQualityCheck';
export { QAConclusion } from './QAConclusion';

// Other Actions
export { Coordinate } from './Coordinate';

// Import for registry
import { WriteMRD } from './WriteMRD';
import { WritePRD } from './WritePRD';
import { WriteDesign } from './WriteDesign';
import { WriteCode } from './WriteCode';
import { WriteTest } from './WriteTest';
import { WriteTestPlan } from './WriteTestPlan';
import { GeneratePrototype } from './GeneratePrototype';
import { MRDReview } from './MRDReview';
import { PRDReview } from './PRDReview';
import { DesignReview } from './DesignReview';
import { ImprovePRD } from './ImprovePRD';
import { ImproveMRD } from './ImproveMRD';
import { ImproveDesign } from './ImproveDesign';
import { ExecuteSubtask } from './ExecuteSubtask';
import { ExecuteProjectManagement } from './ExecuteProjectManagement';
import { ImproveCode } from './ImproveCode';
import { Deploy } from './Deploy';
import { TestReview } from './TestReview';
import { ImproveTest } from './ImproveTest';
import { AutomationPlanning } from './AutomationPlanning';
import { AutomationExecution } from './AutomationExecution';
import { ApiAutomationPlanning } from './ApiAutomationPlanning';
import { ApiAutomationExecution } from './ApiAutomationExecution';
import { CoverageQualityCheck } from './CoverageQualityCheck';
import { QAConclusion } from './QAConclusion';
import { Coordinate } from './Coordinate';

/**
 * Action Registry - Central registry for all action classes
 * When adding a new action:
 * 1. Create the action file (e.g., NewAction.ts)
 * 2. Add export above
 * 3. Add to this registry
 * 4. Run database migration to add action definition
 */
export const ACTION_REGISTRY: Record<string, new () => BaseAction> = {
  // Document Writing Actions
  WriteMRD,
  WritePRD,
  WriteDesign,
  WriteCode,
  WriteTest,
  WriteTestPlan,
  GeneratePrototype,
  // Document Review Actions
  MRDReview,
  PRDReview,
  DesignReview,
  // Document Improvement Actions
  ImprovePRD,
  ImproveMRD,
  ImproveDesign,
  // Task Management Actions
  ExecuteSubtask,
  // OpenSpec Actions
  ExecuteProjectManagement,
  // Code Improvement Actions
  ImproveCode,
  Deploy,
  // QA Actions
  TestReview,
  ImproveTest,
  AutomationPlanning,
  AutomationExecution,
  ApiAutomationPlanning,
  ApiAutomationExecution,
  CoverageQualityCheck,
  QAConclusion,
  // Other Actions
  Coordinate,
};
