/**
 * Default Workflow Configuration
 * 
 * This is the single source of truth for all workflow-related configurations.
 * Used by:
 * - WorkflowService: Runtime workflow execution
 * - Migration scripts: Database schema updates
 * - Seed scripts: Initial database population
 * 
 * Structure:
 * 1. Type definitions
 * 2. Role definitions (metadata for database seeding)
 * 3. Action definitions (metadata for database seeding)
 * 4. Workflow configuration (runtime workflow structure)
 * 5. Action configuration maps (runtime behavior configuration)
 */

import { WorkflowConfig } from '../backend/src/database/repositories/ApplicationWorkflowRepository';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Role definition type for seeding database
 */
export interface RoleDefinition {
  profile: string;
  name: string;
  display_name: string;
  goal: string;
  constraints: string;
  description: string;
  class_name: string;
}

/**
 * Action definition type for seeding database
 */
export interface ActionDefinition {
  name: string;
  display_name: string;
  description: string;
  class_name: string;
  category: string;
}

/**
 * Action dependency configuration
 */
export interface ActionDependency {
  documentAction?: string;  // Action that produces the document (e.g., 'WritePRD' for 'PRDReview')
  reviewAction?: string;    // Action that produces the review (e.g., 'PRDReview' for 'ImprovePRD')
  documentType?: string;    // Human-readable document type (e.g., 'PRD', 'MRD') for logging
}

// ============================================================================
// Role Definitions
// ============================================================================

/**
 * Role definitions for seeding database
 * 
 * These definitions are used to populate the role_definitions table.
 * Roles are ordered by their execution order in the workflow.
 */
export const roleDefinitions: RoleDefinition[] = [
  // Order 0: Salesperson - Workflow entry point
  {
    profile: 'Salesperson',
    name: 'Salesperson',
    display_name: '销售',
    goal: '收集和理解客户需求，编写市场需求文档（MRD），为产品开发提供需求输入',
    constraints: '必须基于真实客户需求，确保需求的可实现性和商业价值；遵循诚实守信原则，建立长期合作关系',
    description: '作为工作流的起始角色，负责与客户沟通、收集市场需求、编写MRD文档。在MRD完成后进行自我评审，并根据反馈持续改进MRD，确保需求文档准确反映客户真实需求。',
    class_name: 'Salesperson',
  },

  // Order 1: ProductManager - Converts MRD to PRD
  {
    profile: 'ProductManager',
    name: 'Product Manager',
    display_name: '产品经理',
    goal: '基于MRD编写产品需求文档（PRD），定义产品功能和特性，生成产品原型',
    constraints: 'PRD必须清晰、完整、可执行；功能定义需考虑技术可行性和用户体验；确保产品方案有明确的商业价值',
    description: '负责将市场需求转化为产品需求。监听Salesperson的MRD输出，基于MRD编写PRD文档，进行PRD评审，根据反馈改进PRD，并基于PRD生成高保真HTML原型。确保产品需求文档准确、完整，为后续开发提供明确指导。',
    class_name: 'ProductManager',
  },

  // Order 2: QAEngineer - Creates test plans and cases
  {
    profile: 'QAEngineer',
    name: 'QA Engineer',
    display_name: 'QA工程师',
    goal: '基于PRD编写测试计划和测试用例，执行测试并生成测试报告，确保产品质量',
    constraints: '测试计划需覆盖PRD中的所有功能点；测试用例需具备可执行性和可追溯性；测试执行需客观公正，及时发现问题',
    description: '负责产品质量保证。监听ProductManager的PRD输出，基于PRD编写测试计划，编写测试用例和测试代码，进行测试评审，根据反馈改进测试。确保测试覆盖全面，能够有效发现产品缺陷。',
    class_name: 'QAEngineer',
  },

  // Order 3: Architect - Designs system architecture
  {
    profile: 'Architect',
    name: 'Architect',
    display_name: '架构师',
    goal: '基于PRD设计系统架构和技术方案，确保技术方案的可行性和可维护性',
    constraints: '架构设计需满足性能、可扩展性、安全性、可维护性要求；技术选型需考虑团队技术栈和项目约束；设计方案需有清晰的文档说明',
    description: '负责系统架构设计。监听ProductManager的PRD输出，基于PRD编写系统设计文档，进行设计评审，根据反馈改进设计。确保技术方案可行、合理，为开发团队提供清晰的技术指导。',
    class_name: 'Architect',
  },

  // Order 4: ProjectManager - Project planning and estimation
  {
    profile: 'ProjectManager',
    name: 'Project Manager',
    display_name: '项目经理',
    goal: '基于PRD和设计文档进行项目规划，创建OpenSpec变更提案，评估故事点，管理项目进度',
    constraints: '项目规划需基于实际需求和资源约束；故事点评估需客观准确；变更提案需符合OpenSpec规范；确保项目进度可控',
    description: '负责项目管理和规划。监听ProductManager的PRD和Architect的设计文档，填充项目上下文，创建OpenSpec变更提案，验证提案格式，评估故事点，验证评估完整性。确保项目规划合理，进度可控。',
    class_name: 'ProjectManager',
  },

  // Order 5: Engineer - Code implementation and deployment
  {
    profile: 'Engineer',
    name: 'Engineer',
    display_name: '工程师',
    goal: '基于PRD、设计文档和项目规划实现代码，持续改进代码质量，完成部署',
    constraints: '代码实现需严格遵循PRD和设计文档；遵循编码规范和最佳实践；确保代码质量和可维护性；部署前需充分测试',
    description: '负责代码实现和部署。监听ProductManager的PRD、Architect的设计文档和ProjectManager的故事点评估，编写代码，根据QA反馈改进代码，完成部署。确保代码质量高，功能完整，系统稳定运行。',
    class_name: 'Engineer',
  },

  // Order 6: AutomationEngineer - Automation testing and QA
  {
    profile: 'AutomationEngineer',
    name: 'Automation Engineer',
    display_name: '自动化工程师',
    goal: '规划自动化测试方案，执行自动化测试，检查测试覆盖率，生成QA结论报告',
    constraints: '自动化方案需可维护、可扩展；测试执行需稳定可靠；覆盖率检查需客观准确；QA结论需基于实际测试结果',
    description: '负责自动化测试和质量保证。监听QAEngineer的测试改进输出，规划自动化测试方案，执行自动化测试，检查测试覆盖率，生成QA结论报告。确保自动化测试有效，质量评估准确。',
    class_name: 'AutomationEngineer',
  },

  // TeamLeader - Team management (not in default workflow)
  {
    profile: 'TeamLeader',
    name: 'Team Leader',
    display_name: '团队负责人',
    goal: '领导团队完成项目目标，协调团队成员工作，做出技术决策',
    constraints: '合理分配任务，确保团队成员工作量均衡；激励团队，保持团队士气；技术决策需基于团队能力和项目需求',
    description: '负责团队管理和技术领导。协调团队成员工作，分配任务，做出技术决策，确保团队高效协作，项目顺利推进。',
    class_name: 'TeamLeader',
  },
];

// ============================================================================
// Action Definitions
// ============================================================================

/**
 * Action definitions for seeding database
 * 
 * These definitions are used to populate the action_definitions table.
 * Actions are grouped by category for better organization.
 */

// Document Writing Actions
const DOCUMENT_WRITING_ACTIONS: ActionDefinition[] = [
  { name: 'WriteMRD', display_name: '编写MRD', description: '编写市场需求文档', class_name: 'WriteMRD', category: 'document_writing' },
  { name: 'WritePRD', display_name: '编写PRD', description: '编写产品需求文档', class_name: 'WritePRD', category: 'document_writing' },
  { name: 'WriteDesign', display_name: '编写设计文档', description: '编写系统设计文档', class_name: 'WriteDesign', category: 'document_writing' },
  { name: 'WriteCode', display_name: '编写代码', description: '实现代码', class_name: 'WriteCode', category: 'document_writing' },
  { name: 'WriteTest', display_name: '编写测试', description: '编写测试用例和代码', class_name: 'WriteTest', category: 'document_writing' },
  { name: 'WriteTestPlan', display_name: '编写测试计划', description: '编写测试计划文档', class_name: 'WriteTestPlan', category: 'document_writing' },
  { name: 'GeneratePrototype', display_name: '生成原型', description: '基于PRD生成高保真HTML原型', class_name: 'GeneratePrototype', category: 'document_writing' },
];

// Review Actions
const REVIEW_ACTIONS: ActionDefinition[] = [
  { name: 'MRDReview', display_name: 'MRD评审', description: '评审市场需求文档', class_name: 'MRDReview', category: 'review' },
  { name: 'PRDReview', display_name: 'PRD评审', description: '评审产品需求文档', class_name: 'PRDReview', category: 'review' },
  { name: 'DesignReview', display_name: '设计评审', description: '评审系统设计文档', class_name: 'DesignReview', category: 'review' },
  { name: 'TestReview', display_name: '测试评审', description: '评审测试用例', class_name: 'TestReview', category: 'review' },
];

// Improvement Actions
const IMPROVEMENT_ACTIONS: ActionDefinition[] = [
  { name: 'ImproveMRD', display_name: '改进MRD', description: '根据反馈改进MRD', class_name: 'ImproveMRD', category: 'improvement' },
  { name: 'ImprovePRD', display_name: '改进PRD', description: '根据反馈改进PRD', class_name: 'ImprovePRD', category: 'improvement' },
  { name: 'ImproveDesign', display_name: '改进设计', description: '根据反馈改进设计', class_name: 'ImproveDesign', category: 'improvement' },
  { name: 'ImproveTest', display_name: '改进测试', description: '根据反馈改进测试', class_name: 'ImproveTest', category: 'improvement' },
  { name: 'ImproveCode', display_name: '改进代码', description: '基于QA反馈和用户建议改进代码质量', class_name: 'ImproveCode', category: 'improvement' },
];

// Execution Actions
const EXECUTION_ACTIONS: ActionDefinition[] = [
  { name: 'Deploy', display_name: '部署', description: '部署应用程序', class_name: 'Deploy', category: 'execution' },
  { name: 'ExecuteSubtask', display_name: '执行子任务', description: '执行分解的子任务', class_name: 'ExecuteSubtask', category: 'execution' },
  { name: 'AutomationExecution', display_name: '自动化执行', description: '执行自动化任务', class_name: 'AutomationExecution', category: 'execution' },
];

// Planning Actions
const PLANNING_ACTIONS: ActionDefinition[] = [
  { name: 'AutomationPlanning', display_name: '自动化规划', description: '规划自动化方案', class_name: 'AutomationPlanning', category: 'planning' },
  { name: 'ExecuteProjectManagement', display_name: '执行项目管理', description: '执行完整的项目管理流程（填充上下文、创建提案、验证格式、审查内容、评估故事点、验证评估）', class_name: 'ExecuteProjectManagement', category: 'planning' },
  // Legacy actions - kept for backward compatibility but not used in default workflow
  { name: 'FillProjectContext', display_name: '填充项目上下文', description: '基于PRD和设计文档填充项目上下文', class_name: 'FillProjectContext', category: 'planning' },
  { name: 'CreateOpenSpecProposal', display_name: '创建变更提案', description: '创建OpenSpec变更提案', class_name: 'CreateOpenSpecProposal', category: 'planning' },
  { name: 'ValidateOpenSpecProposal', display_name: '验证变更提案', description: '验证OpenSpec变更提案格式', class_name: 'ValidateOpenSpecProposal', category: 'planning' },
  { name: 'ValidateOpenSpecContent', display_name: '验证变更内容', description: '验证OpenSpec变更内容一致性', class_name: 'ValidateOpenSpecContent', category: 'planning' },
  { name: 'EstimateStoryPoints', display_name: '故事点评估', description: '为任务添加故事点评估', class_name: 'EstimateStoryPoints', category: 'planning' },
  { name: 'ValidateStoryPointEstimates', display_name: '验证故事点评估', description: '验证故事点评估完整性', class_name: 'ValidateStoryPointEstimates', category: 'planning' },
  { name: 'Coordinate', display_name: '协调', description: '协调团队工作', class_name: 'Coordinate', category: 'planning' },
];

// Analysis Actions
const ANALYSIS_ACTIONS: ActionDefinition[] = [
  { name: 'QAConclusion', display_name: 'QA结论', description: '生成QA结论报告', class_name: 'QAConclusion', category: 'analysis' },
  { name: 'CoverageQualityCheck', display_name: '覆盖率检查', description: '检查测试覆盖率', class_name: 'CoverageQualityCheck', category: 'analysis' },
];

// Combine all action definitions
export const actionDefinitions: ActionDefinition[] = [
  ...DOCUMENT_WRITING_ACTIONS,
  ...REVIEW_ACTIONS,
  ...IMPROVEMENT_ACTIONS,
  ...EXECUTION_ACTIONS,
  ...PLANNING_ACTIONS,
  ...ANALYSIS_ACTIONS,
];

// ============================================================================
// Workflow Configuration
// ============================================================================

/**
 * Default workflow configuration
 * 
 * This is the single source of truth for the default workflow structure.
 * Used by both runtime execution and migration scripts.
 * 
 * Workflow execution order:
 * 0. Salesperson: WriteMRD -> MRDReview -> ImproveMRD
 * 1. ProductManager: WritePRD -> PRDReview -> ImprovePRD -> GeneratePrototype
 * 2. QAEngineer: WriteTestPlan -> WriteTest -> TestReview -> ImproveTest
 * 3. Architect: WriteDesign -> DesignReview -> ImproveDesign
 * 4. ProjectManager: ExecuteProjectManagement (完整项目管理流程：填充上下文 -> 创建提案 -> 验证格式 -> 审查内容 -> 评估故事点 -> 验证评估)
 * 5. Engineer: WriteCode -> ImproveCode -> Deploy
 * 6. AutomationEngineer: AutomationPlanning -> AutomationExecution -> CoverageQualityCheck -> QAConclusion
 */
export const defaultWorkflowConfig: WorkflowConfig = {
  roles: [
    {
      profile: 'Salesperson',
      name: 'Salesperson',
      order: 0,
      actions: ['WriteMRD'],
      watch_actions: ['User'],
    },
    {
      profile: 'ProductManager',
      name: 'Product Manager',
      order: 1,
      actions: ['WritePRD', 'GeneratePrototype'],
      watch_actions: ['WriteMRD'],
    },
    {
      profile: 'QAEngineer',
      name: 'QA Engineer',
      order: 2,
      actions: ['WriteTest'],
      watch_actions: ['WritePRD'],
    },
    {
      profile: 'Architect',
      name: 'Architect',
      order: 3,
      actions: ['WriteDesign'],
      watch_actions: ['WritePRD'],
    },
    {
      profile: 'ProjectManager',
      name: 'Project Manager',
      order: 4,
      actions: ['ExecuteProjectManagement'],
      watch_actions: ['WritePRD', 'WriteDesign'],
    },
    {
      profile: 'Engineer',
      name: 'Engineer',
      order: 5,
      actions: ['WriteCode', 'ImproveCode', 'Deploy'],
      watch_actions: ['WritePRD', 'WriteDesign', 'ExecuteProjectManagement'],
    },
    {
      profile: 'AutomationEngineer',
      name: 'Automation Engineer',
      order: 6,
      actions: ['AutomationPlanning', 'AutomationExecution', 'CoverageQualityCheck', 'QAConclusion'],
      watch_actions: ['ImproveTest'],
    },
  ],
};

/**
 * Helper function to get default workflow config
 * Maintains backward compatibility with existing code
 */
export function getDefaultWorkflowConfig(): WorkflowConfig {
  return defaultWorkflowConfig;
}

// ============================================================================
// Action Configuration Maps
// ============================================================================

/**
 * Actions that accept workspace options parameter
 * 
 * These actions require workspace context (applicationId, projectId, version, etc.)
 * to organize files and manage workspace structure.
 * 
 * This list is used by RoleActionExecutor to determine which actions should receive
 * workspace options when executing.
 */
export const actionsWithWorkspaceOptions: string[] = [
  // Document Writing actions
  'WriteMRD',
  'WritePRD',
  'WriteDesign',
  'WriteCode',
  'WriteTest',
  'WriteTestPlan',
  'GeneratePrototype',
  
  // Review actions
  'MRDReview',
  'PRDReview',
  'DesignReview',
  'TestReview',
  
  // Improvement actions
  'ImprovePRD',
  'ImproveMRD',
  'ImproveDesign',
  'ImproveTest',
  'ImproveCode',
  
  // Execution actions
  'ExecuteSubtask',
  'Deploy',
  
  // Automation actions
  'AutomationPlanning',
  'AutomationExecution',
  'CoverageQualityCheck',
  'QAConclusion',
  
  // Project Management actions
  'ExecuteProjectManagement',
  'FillProjectContext',
  'CreateOpenSpecProposal',
  'ValidateOpenSpecProposal',
  'ValidateOpenSpecContent',
  'EstimateStoryPoints',
  'ValidateStoryPointEstimates',
];

/**
 * Action relevance map
 * 
 * Defines which message types (causeBy) are relevant for each action.
 * Used by RoleActionExecutionController to load relevant messages from project history.
 * 
 * Mapping rules:
 * - Actions depend on previous actions in the same role
 * - Actions depend on watch_actions defined for their role
 * - Review actions depend on their corresponding Write action
 * - Improve actions depend on Write and Review actions
 * 
 * Key: action name
 * Value: array of message types (causeBy) that this action should pay attention to
 */
export const actionRelevanceMap: Record<string, string[]> = {
  // Salesperson actions (order 0, watch: User)
  WriteMRD: ['UserInput'],
  MRDReview: ['WriteMRD'],
  ImproveMRD: ['WriteMRD', 'MRDReview'],

  // Product Manager actions (order 1, watch: WriteMRD, ImproveMRD)
  WritePRD: ['WriteMRD', 'ImproveMRD', 'UserInput'],
  PRDReview: ['WritePRD'],
  ImprovePRD: ['WritePRD', 'PRDReview'],
  GeneratePrototype: ['WritePRD', 'PRDReview'],

  // QA Engineer actions (order 2, watch: WritePRD, ImprovePRD)
  WriteTestPlan: ['ImprovePRD'],
  WriteTest: ['ImprovePRD', 'WriteTestPlan'],
  TestReview: ['WriteTest', 'WriteTestPlan'],
  ImproveTest: ['WriteTest', 'TestReview'],

  // Architect actions (order 3, watch: WritePRD, ImprovePRD)
  WriteDesign: ['ImprovePRD'],
  DesignReview: ['WriteDesign'],
  ImproveDesign: ['WriteDesign', 'DesignReview'],

  // Project Manager actions (order 4, watch: WritePRD, WriteDesign)
  ExecuteProjectManagement: ['ImprovePRD', 'ImproveDesign'],
  // Legacy actions - kept for backward compatibility
  FillProjectContext: ['ImprovePRD', 'ImproveDesign'],
  CreateOpenSpecProposal: ['FillProjectContext'],
  ValidateOpenSpecProposal: ['CreateOpenSpecProposal'],
  ValidateOpenSpecContent: ['ValidateOpenSpecProposal'],
  EstimateStoryPoints: ['ValidateOpenSpecContent'],
  ValidateStoryPointEstimates: ['EstimateStoryPoints'],

  // Engineer actions (order 5, watch: WritePRD, WriteDesign, ExecuteProjectManagement)
  WriteCode: ['ImprovePRD', 'ImproveDesign', 'ExecuteProjectManagement'],
  ImproveCode: ['WriteCode'],
  Deploy: ['ImproveCode'],

  // Automation Engineer actions (order 6, watch: ImproveTest)
  AutomationPlanning: ['ImproveTest'],
  AutomationExecution: ['AutomationPlanning'],
  CoverageQualityCheck: ['AutomationExecution'],
  QAConclusion: ['CoverageQualityCheck'],
};

/**
 * Action dependencies map
 * 
 * Defines which actions depend on which other actions for input preparation.
 * Used by RoleActionExecutor to prepare action inputs dynamically.
 * 
 * This configuration centralizes the hardcoded action dependencies that were
 * previously scattered in RoleActionExecutor.prepareActionInput and related methods.
 */
export const actionDependencies: Record<string, ActionDependency> = {
  // WriteTest and WriteTestPlan depend on WritePRD for PRD content
  WriteTest: { documentAction: 'WritePRD' },
  WriteTestPlan: { documentAction: 'WritePRD' },
  
  // Review actions depend on their corresponding Write actions
  MRDReview: { documentAction: 'WriteMRD', documentType: 'MRD' },
  PRDReview: { documentAction: 'WritePRD', documentType: 'PRD' },
  DesignReview: { documentAction: 'WriteDesign', documentType: 'Design' },
  TestReview: { documentAction: 'WriteTest', documentType: 'Test' },
  
  // Improve actions depend on their corresponding Review actions
  ImprovePRD: { reviewAction: 'PRDReview', documentType: 'PRD review report' },
  ImproveMRD: { reviewAction: 'MRDReview', documentType: 'MRD review report' },
  ImproveDesign: { reviewAction: 'DesignReview', documentType: 'Design review report' },
  ImproveTest: { reviewAction: 'TestReview', documentType: 'test review report' },
};

/**
 * Deprecated action name mappings
 * 
 * Maps deprecated/renamed action names to their current equivalents.
 * Used by migration scripts to update historical data in action_logs and messages tables.
 * 
 * Key: deprecated action name
 * Value: new action name (or null if action was removed without replacement)
 */
export const deprecatedActionMappings: Record<string, string | null> = {
  // BreakdownTasks was replaced by OpenSpec actions, map to first replacement action
  BreakdownTasks: 'FillProjectContext',
  
  // TestCaseReview was renamed to TestReview
  TestCaseReview: 'TestReview',
  
  // If an action was completely removed, set value to null
  // The migration script will handle null values appropriately
};

/**
 * Action to document type mapping
 * 
 * Defines which document type directory each action should use in the workspace.
 * Used by RoleWorkspaceExtractor to determine the correct document type for file paths.
 * 
 * Key: action name
 * Value: document type directory name (e.g., 'MRD', 'PRD', 'DESIGN', 'CODE', 'TEST')
 */
export const actionDocumentTypeMap: Record<string, string> = {
  // Document Writing Actions
  WriteMRD: 'MRD',
  WritePRD: 'PRD',
  WriteDesign: 'DESIGN',
  WriteCode: 'CODE',
  WriteTest: 'TEST',
  WriteTestPlan: 'TEST',
  GeneratePrototype: 'PROTOTYPE',
  
  // Review Actions (use same document type as their corresponding Write action)
  MRDReview: 'MRD',
  PRDReview: 'PRD',
  DesignReview: 'DESIGN',
  TestReview: 'TEST',
  
  // Improvement Actions (use same document type as their corresponding Write action)
  ImproveMRD: 'MRD',
  ImprovePRD: 'PRD',
  ImproveDesign: 'DESIGN',
  ImproveTest: 'TEST',
  ImproveCode: 'CODE',
  
  // Execution Actions
  ExecuteSubtask: 'CODE',
  Deploy: 'CODE',
  AutomationExecution: 'TEST',
  
  // Planning Actions (use appropriate document types)
  ExecuteProjectManagement: 'TASKS',
  FillProjectContext: 'TASKS',
  CreateOpenSpecProposal: 'TASKS',
  ValidateOpenSpecProposal: 'TASKS',
  ValidateOpenSpecContent: 'TASKS',
  EstimateStoryPoints: 'TASKS',
  ValidateStoryPointEstimates: 'TASKS',
  AutomationPlanning: 'TEST',
  
  // Analysis Actions
  CoverageQualityCheck: 'TEST',
  QAConclusion: 'TEST',
};
