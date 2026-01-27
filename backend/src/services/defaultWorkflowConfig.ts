/**
 * Default Workflow Configuration
 * Single source of truth for default workflow settings
 * Used by both WorkflowService and seed_data migration
 */

import { WorkflowConfig } from '../database/repositories/ApplicationWorkflowRepository';

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
 * Role definitions for seeding database
 */
export const roleDefinitions: RoleDefinition[] = [
  {
    profile: 'ProductManager',
    name: 'Product Manager',
    display_name: '产品经理',
    goal: '基于用户需求编写产品需求文档（PRD）',
    constraints: '确保需求清晰、可实现、有商业价值',
    description: '负责理解用户需求，编写PRD，协调产品开发',
    class_name: 'ProductManager',
  },
  {
    profile: 'Architect',
    name: 'Architect',
    display_name: '架构师',
    goal: '设计系统架构，确保技术方案可行',
    constraints: '考虑性能、可扩展性、安全性',
    description: '负责系统架构设计，评审技术方案',
    class_name: 'Architect',
  },
  {
    profile: 'Engineer',
    name: 'Engineer',
    display_name: '工程师',
    goal: '实现代码，完成开发任务',
    constraints: '遵循编码规范，确保代码质量',
    description: '负责代码实现、单元测试、代码审查',
    class_name: 'Engineer',
  },
  {
    profile: 'QAEngineer',
    name: 'QA Engineer',
    display_name: 'QA工程师',
    goal: '编写测试用例，执行测试',
    constraints: '确保测试覆盖率，发现潜在问题',
    description: '负责测试计划、测试用例、自动化测试',
    class_name: 'QAEngineer',
  },
  {
    profile: 'ProjectManager',
    name: 'Project Manager',
    display_name: '项目经理',
    goal: '协调团队，管理项目进度',
    constraints: '平衡质量、时间、成本',
    description: '负责项目规划、进度跟踪、风险管理',
    class_name: 'ProjectManager',
  },
  {
    profile: 'TeamLeader',
    name: 'Team Leader',
    display_name: '团队负责人',
    goal: '领导团队完成目标',
    constraints: '合理分配任务，激励团队',
    description: '负责团队管理、任务分配、技术决策',
    class_name: 'TeamLeader',
  },
  {
    profile: 'Salesperson',
    name: 'Salesperson',
    display_name: '销售',
    goal: '理解客户需求，促成交易',
    constraints: '诚实守信，长期合作',
    description: '负责客户沟通、需求收集、商务谈判',
    class_name: 'Salesperson',
  },
  {
    profile: 'DataAnalyst',
    name: 'Data Analyst',
    display_name: '数据分析师',
    goal: '分析数据，提供洞察',
    constraints: '确保数据准确性和时效性',
    description: '负责数据分析、报表制作、数据可视化',
    class_name: 'DataAnalyst',
  },
  {
    profile: 'AutomationEngineer',
    name: 'Automation Engineer',
    display_name: '自动化工程师',
    goal: '实现流程自动化',
    constraints: '确保自动化稳定可靠',
    description: '负责自动化脚本、CI/CD、基础设施',
    class_name: 'AutomationEngineer',
  },
];

/**
 * Action definitions for seeding database
 */
export const actionDefinitions: ActionDefinition[] = [
  // Document Writing
  { name: 'WriteMRD', display_name: '编写MRD', description: '编写市场需求文档', class_name: 'WriteMRD', category: 'document_writing' },
  { name: 'WritePRD', display_name: '编写PRD', description: '编写产品需求文档', class_name: 'WritePRD', category: 'document_writing' },
  { name: 'WriteDesign', display_name: '编写设计文档', description: '编写系统设计文档', class_name: 'WriteDesign', category: 'document_writing' },
  { name: 'WriteCode', display_name: '编写代码', description: '实现代码', class_name: 'WriteCode', category: 'document_writing' },
  { name: 'WriteTest', display_name: '编写测试', description: '编写测试用例和代码', class_name: 'WriteTest', category: 'document_writing' },
  { name: 'WriteTestPlan', display_name: '编写测试计划', description: '编写测试计划文档', class_name: 'WriteTestPlan', category: 'document_writing' },
  { name: 'WriteSubProjectDesign', display_name: '编写子项目设计', description: '编写子项目设计文档', class_name: 'WriteSubProjectDesign', category: 'document_writing' },

  // Reviews
  { name: 'MRDReview', display_name: 'MRD评审', description: '评审市场需求文档', class_name: 'MRDReview', category: 'review' },
  { name: 'PRDReview', display_name: 'PRD评审', description: '评审产品需求文档', class_name: 'PRDReview', category: 'review' },
  { name: 'DesignReview', display_name: '设计评审', description: '评审系统设计文档', class_name: 'DesignReview', category: 'review' },
  { name: 'CodeReview', display_name: '代码评审', description: '评审代码质量', class_name: 'CodeReview', category: 'review' },
  { name: 'TestReview', display_name: '测试评审', description: '评审测试用例', class_name: 'TestReview', category: 'review' },
  { name: 'TestabilityReview', display_name: '可测试性评审', description: '评审代码可测试性', class_name: 'TestabilityReview', category: 'review' },
  { name: 'SubProjectDesignReview', display_name: '子项目设计评审', description: '评审子项目设计', class_name: 'SubProjectDesignReview', category: 'review' },

  // Improvements
  { name: 'ImproveMRD', display_name: '改进MRD', description: '根据反馈改进MRD', class_name: 'ImproveMRD', category: 'improvement' },
  { name: 'ImprovePRD', display_name: '改进PRD', description: '根据反馈改进PRD', class_name: 'ImprovePRD', category: 'improvement' },
  { name: 'ImproveDesign', display_name: '改进设计', description: '根据反馈改进设计', class_name: 'ImproveDesign', category: 'improvement' },
  { name: 'ImproveTest', display_name: '改进测试', description: '根据反馈改进测试', class_name: 'ImproveTest', category: 'improvement' },
  { name: 'FixBug', display_name: '修复Bug', description: '修复代码缺陷', class_name: 'FixBug', category: 'improvement' },

  // Execution
  { name: 'RunCode', display_name: '运行代码', description: '执行代码运行', class_name: 'RunCode', category: 'execution' },
  { name: 'Deploy', display_name: '部署', description: '部署应用程序', class_name: 'Deploy', category: 'execution' },
  { name: 'ExecuteSubtask', display_name: '执行子任务', description: '执行分解的子任务', class_name: 'ExecuteSubtask', category: 'execution' },
  { name: 'AutomationExecution', display_name: '自动化执行', description: '执行自动化任务', class_name: 'AutomationExecution', category: 'execution' },

  // Planning & Analysis
  { name: 'BreakdownTasks', display_name: '任务分解', description: '将大任务分解为子任务并评估故事点', class_name: 'BreakdownTasks', category: 'planning' },
  { name: 'AutomationPlanning', display_name: '自动化规划', description: '规划自动化方案', class_name: 'AutomationPlanning', category: 'planning' },
  { name: 'Coordinate', display_name: '协调', description: '协调团队工作', class_name: 'Coordinate', category: 'planning' },
  { name: 'DataAnalysis', display_name: '数据分析', description: '分析数据生成报告', class_name: 'DataAnalysis', category: 'analysis' },
  { name: 'SearchEnhancedQA', display_name: '搜索增强QA', description: '基于搜索的问答', class_name: 'SearchEnhancedQA', category: 'analysis' },
  { name: 'QAConclusion', display_name: 'QA结论', description: '生成QA结论报告', class_name: 'QAConclusion', category: 'analysis' },
  { name: 'CoverageQualityCheck', display_name: '覆盖率检查', description: '检查测试覆盖率', class_name: 'CoverageQualityCheck', category: 'analysis' },
];

/**
 * Default workflow configuration
 * Single source of truth - used by both runtime and migration
 * 
 * 配置与角色定义保持一致：
 * - Salesperson: WriteMRD -> MRDReview -> ImproveMRD
 * - ProductManager: WritePRD -> PRDReview -> ImprovePRD
 * - QAEngineer: WriteTestPlan -> WriteTest -> TestReview -> ImproveTest
 * - Architect: WriteDesign -> DesignReview -> ImproveDesign
 * - ProjectManager: BreakdownTasks
 * - Engineer: WriteCode
 * - AutomationEngineer: AutomationPlanning -> AutomationExecution -> CoverageQualityCheck -> QAConclusion
 */
export const defaultWorkflowConfig: WorkflowConfig = {
  roles: [
    {
      profile: 'Salesperson',
      name: 'Salesperson',
      order: 0,
      actions: ['WriteMRD', 'MRDReview', 'ImproveMRD'],
      watch_actions: ['User'],
    },
    {
      profile: 'ProductManager',
      name: 'Product Manager',
      order: 1,
      actions: ['WritePRD', 'PRDReview', 'ImprovePRD'],
      watch_actions: ['WriteMRD', 'ImproveMRD'],
    },
    {
      profile: 'QAEngineer',
      name: 'QA Engineer',
      order: 2,
      actions: ['WriteTestPlan', 'WriteTest', 'TestReview', 'ImproveTest'],
      watch_actions: ['WritePRD', 'ImprovePRD'],
    },
    {
      profile: 'Architect',
      name: 'Architect',
      order: 3,
      actions: ['WriteDesign', 'DesignReview', 'ImproveDesign'],
      watch_actions: ['WritePRD', 'ImprovePRD'],
    },
    {
      profile: 'ProjectManager',
      name: 'Project Manager',
      order: 4,
      actions: ['BreakdownTasks'],
      watch_actions: ['WritePRD', 'WriteDesign'],
    },
    {
      profile: 'Engineer',
      name: 'Engineer',
      order: 5,
      actions: ['WriteCode', 'Deploy'],
      watch_actions: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
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
