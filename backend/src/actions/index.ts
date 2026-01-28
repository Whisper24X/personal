/**
 * Agent Actions
 * Exports all action implementations and action registry
 */

import { BaseAction } from '../core/base/BaseAction';

// Document Writing Actions
export { WriteMRD } from './WriteMRD';
export { WritePRD } from './WritePRD';
export { WriteDesign } from './WriteDesign';
export { WriteSubProjectDesign } from './WriteSubProjectDesign';
export { WriteCode } from './WriteCode';
export { WriteTest } from './WriteTest';
export { WriteTestPlan } from './WriteTestPlan';

// Document Review Actions
export { MRDReview } from './MRDReview';
export { PRDReview } from './PRDReview';
export { DesignReview } from './DesignReview';
export { SubProjectDesignReview } from './SubProjectDesignReview';
export { CodeReview } from './CodeReview';

// Document Improvement Actions
export { ImprovePRD } from './ImprovePRD';
export { ImproveMRD } from './ImproveMRD';
export { ImproveDesign } from './ImproveDesign';

// Task Management Actions
export { ExecuteSubtask } from './ExecuteSubtask';

// OpenSpec Actions
export { FillProjectContext } from './FillProjectContext';
export { CreateOpenSpecProposal } from './CreateOpenSpecProposal';
export { ValidateOpenSpecProposal } from './ValidateOpenSpecProposal';
export { EstimateStoryPoints } from './EstimateStoryPoints';
export { ValidateStoryPointEstimates } from './ValidateStoryPointEstimates';

// Code Execution and Bug Fix Actions
export { RunCode } from './RunCode';
export { FixBug } from './FixBug';
export { Deploy } from './Deploy';

// QA Actions
export { TestabilityReview } from './TestabilityReview';
export { TestReview } from './TestReview';
export { ImproveTest } from './ImproveTest';
export { AutomationPlanning } from './AutomationPlanning';
export { AutomationExecution } from './AutomationExecution';
export { CoverageQualityCheck } from './CoverageQualityCheck';
export { QAConclusion } from './QAConclusion';

// Other Actions
export { SearchEnhancedQA } from './SearchEnhancedQA';
export { DataAnalysis } from './DataAnalysis';
export { Coordinate } from './Coordinate';

// Import for registry
import { WriteMRD } from './WriteMRD';
import { WritePRD } from './WritePRD';
import { WriteDesign } from './WriteDesign';
import { WriteSubProjectDesign } from './WriteSubProjectDesign';
import { WriteCode } from './WriteCode';
import { WriteTest } from './WriteTest';
import { WriteTestPlan } from './WriteTestPlan';
import { MRDReview } from './MRDReview';
import { PRDReview } from './PRDReview';
import { DesignReview } from './DesignReview';
import { SubProjectDesignReview } from './SubProjectDesignReview';
import { CodeReview } from './CodeReview';
import { ImprovePRD } from './ImprovePRD';
import { ImproveMRD } from './ImproveMRD';
import { ImproveDesign } from './ImproveDesign';
import { ExecuteSubtask } from './ExecuteSubtask';
import { FillProjectContext } from './FillProjectContext';
import { CreateOpenSpecProposal } from './CreateOpenSpecProposal';
import { ValidateOpenSpecProposal } from './ValidateOpenSpecProposal';
import { EstimateStoryPoints } from './EstimateStoryPoints';
import { ValidateStoryPointEstimates } from './ValidateStoryPointEstimates';
import { RunCode } from './RunCode';
import { FixBug } from './FixBug';
import { Deploy } from './Deploy';
import { TestabilityReview } from './TestabilityReview';
import { TestReview } from './TestReview';
import { ImproveTest } from './ImproveTest';
import { AutomationPlanning } from './AutomationPlanning';
import { AutomationExecution } from './AutomationExecution';
import { CoverageQualityCheck } from './CoverageQualityCheck';
import { QAConclusion } from './QAConclusion';
import { SearchEnhancedQA } from './SearchEnhancedQA';
import { DataAnalysis } from './DataAnalysis';
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
  WriteSubProjectDesign,
  WriteCode,
  WriteTest,
  WriteTestPlan,
  // Document Review Actions
  MRDReview,
  PRDReview,
  DesignReview,
  SubProjectDesignReview,
  CodeReview,
  // Document Improvement Actions
  ImprovePRD,
  ImproveMRD,
  ImproveDesign,
  // Task Management Actions
  ExecuteSubtask,
  // OpenSpec Actions
  FillProjectContext,
  CreateOpenSpecProposal,
  ValidateOpenSpecProposal,
  EstimateStoryPoints,
  ValidateStoryPointEstimates,
  // Code Execution and Bug Fix Actions
  RunCode,
  FixBug,
  Deploy,
  // QA Actions
  TestabilityReview,
  TestReview,
  ImproveTest,
  AutomationPlanning,
  AutomationExecution,
  CoverageQualityCheck,
  QAConclusion,
  // Other Actions
  SearchEnhancedQA,
  DataAnalysis,
  Coordinate,
};
