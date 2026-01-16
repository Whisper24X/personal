/**
 * Initialize Role and Action Definitions
 * Extracts role and action definitions from code and inserts into database
 */

import { connectDatabase, disconnectDatabase } from '../client';
import { RoleDefinitionRepository, ActionDefinitionRepository, ApplicationWorkflowRepository, SystemDefaultWorkflowTemplateRepository } from '../repositories';
import { logger } from '../../utils';
import { Context } from '../../core/context/Context';
import { WorkflowConfig } from '../repositories/ApplicationWorkflowRepository';

// Import all role classes to extract metadata
import { Salesperson } from '../../roles/Salesperson';
import { ProductManager } from '../../roles/ProductManager';
import { Architect } from '../../roles/Architect';
import { ProjectManager } from '../../roles/ProjectManager';
import { Engineer } from '../../roles/Engineer';
import { QAEngineer } from '../../roles/QAEngineer';
import { TeamLeader } from '../../roles/TeamLeader';
import { DataAnalyst } from '../../roles/DataAnalyst';

// Import all action classes
import { WriteMRD } from '../../actions/WriteMRD';
import { WritePRD } from '../../actions/WritePRD';
import { WriteDesign } from '../../actions/WriteDesign';
import { WriteSubProjectDesign } from '../../actions/WriteSubProjectDesign';
import { WriteCode } from '../../actions/WriteCode';
import { WriteTest } from '../../actions/WriteTest';
import { WriteTestPlan } from '../../actions/WriteTestPlan';
import { MRDReview } from '../../actions/MRDReview';
import { PRDReview } from '../../actions/PRDReview';
import { DesignReview } from '../../actions/DesignReview';
import { SubProjectDesignReview } from '../../actions/SubProjectDesignReview';
import { CodeReview } from '../../actions/CodeReview';
import { TestCaseReview } from '../../actions/TestCaseReview';
import { TestReview } from '../../actions/TestReview';
import { ImprovePRD } from '../../actions/ImprovePRD';
import { ImproveMRD } from '../../actions/ImproveMRD';
import { ImproveDesign } from '../../actions/ImproveDesign';
import { ImproveTest } from '../../actions/ImproveTest';
import { BreakdownTasks } from '../../actions/BreakdownTasks';
import { ExecuteSubtask } from '../../actions/ExecuteSubtask';
import { RunCode } from '../../actions/RunCode';
import { FixBug } from '../../actions/FixBug';
import { TestabilityReview } from '../../actions/TestabilityReview';
import { AutomationPlanning } from '../../actions/AutomationPlanning';
import { AutomationExecution } from '../../actions/AutomationExecution';
import { CoverageQualityCheck } from '../../actions/CoverageQualityCheck';
import { QAConclusion } from '../../actions/QAConclusion';
import { SearchEnhancedQA } from '../../actions/SearchEnhancedQA';
import { DataAnalysis } from '../../actions/DataAnalysis';
import { Coordinate } from '../../actions/Coordinate';

// Role display names mapping (Chinese)
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  Salesperson: '销售',
  ProductManager: '产品经理',
  Architect: '架构师',
  ProjectManager: '项目经理',
  Engineer: '工程师',
  QAEngineer: 'QA工程师',
  TeamLeader: '团队领导',
  DataAnalyst: '数据分析师',
};

// Action display names mapping (Chinese)
const ACTION_DISPLAY_NAMES: Record<string, string> = {
  // Salesperson actions
  WriteMRD: '编写MRD',
  MRDReview: 'MRD审查',
  ImproveMRD: '改进MRD',

  // ProductManager actions
  WritePRD: '编写PRD',
  PRDReview: 'PRD审查',
  ImprovePRD: '改进PRD',
  SearchEnhancedQA: 'RAG增强',

  // Architect actions
  WriteDesign: '编写设计文档',
  DesignReview: '设计审查',
  ImproveDesign: '改进设计',

  // ProjectManager actions
  BreakdownTasks: '任务拆分',
  WriteSubProjectDesign: '子项目设计',
  SubProjectDesignReview: '子项目设计审查',
  CodeReview: '代码审查',

  // Engineer actions
  WriteCode: '编写代码',
  ExecuteSubtask: '执行子任务',
  RunCode: '运行代码',
  FixBug: '修复Bug',

  // QAEngineer actions
  WriteTest: '编写测试',
  WriteTestPlan: '编写测试计划',
  TestabilityReview: '可测性审查',
  TestCaseReview: '测试用例审查',
  TestReview: '测试审查',
  ImproveTest: '改进测试',
  AutomationPlanning: '自动化规划',
  AutomationExecution: '自动化执行',
  CoverageQualityCheck: '覆盖率质量检查',
  QAConclusion: 'QA结论',

  // TeamLeader actions
  Coordinate: '协调工作',

  // DataAnalyst actions
  DataAnalysis: '数据分析',
};

// Action categories
const ACTION_CATEGORIES: Record<string, string> = {
  WriteMRD: 'document_writing',
  WritePRD: 'document_writing',
  WriteDesign: 'document_writing',
  WriteSubProjectDesign: 'document_writing',
  WriteCode: 'code',
  WriteTest: 'test',
  WriteTestPlan: 'test',
  MRDReview: 'review',
  PRDReview: 'review',
  DesignReview: 'review',
  SubProjectDesignReview: 'review',
  CodeReview: 'review',
  TestCaseReview: 'review',
  TestReview: 'review',
  TestabilityReview: 'review',
  ImprovePRD: 'improvement',
  ImproveMRD: 'improvement',
  ImproveDesign: 'improvement',
  ImproveTest: 'improvement',
  BreakdownTasks: 'task_management',
  ExecuteSubtask: 'task_management',
  RunCode: 'execution',
  FixBug: 'bug_fix',
  AutomationPlanning: 'automation',
  AutomationExecution: 'automation',
  CoverageQualityCheck: 'quality_check',
  QAConclusion: 'qa',
  SearchEnhancedQA: 'rag',
  DataAnalysis: 'analysis',
  Coordinate: 'coordination',
};

async function initRoleDefinitions() {
  const roleDefRepo = new RoleDefinitionRepository();
  const context = new Context();

  // Create role instances to extract metadata
  const roles = [
    new Salesperson(context),
    new ProductManager(context),
    new Architect(context),
    new ProjectManager(context),
    new Engineer(context),
    new QAEngineer(context),
    new TeamLeader(context),
    new DataAnalyst(context),
  ];

  logger.info('   📝 Initializing role definitions...');

  for (const role of roles) {
    try {
      // Check if role already exists
      const existing = await roleDefRepo.findByProfile(role.profile);
      if (existing) {
        logger.info(`   ⏭️  Role ${role.profile} already exists, skipping`);
        continue;
      }

      await roleDefRepo.create({
        profile: role.profile,
        name: role.name,
        display_name: ROLE_DISPLAY_NAMES[role.profile] || role.profile,
        goal: role.goal,
        constraints: role.constraints,
        description: role.description,
        class_name: role.constructor.name,
        is_active: true,
      });

      logger.info(`   ✅ Created role definition: ${role.profile}`);
    } catch (error: any) {
      logger.error(`   ❌ Failed to create role ${role.profile}:`, error.message);
      throw error;
    }
  }

  logger.info(`   ✅ Initialized ${roles.length} role definitions`);
}

async function initActionDefinitions() {
  const actionDefRepo = new ActionDefinitionRepository();
  const context = new Context();

  // Collect all actions from roles
  const roles = [
    new Salesperson(context),
    new ProductManager(context),
    new Architect(context),
    new ProjectManager(context),
    new Engineer(context),
    new QAEngineer(context),
    new TeamLeader(context),
    new DataAnalyst(context),
  ];

  // Collect unique actions
  const actionMap = new Map<string, { name: string; description?: string }>();
  roles.forEach((role) => {
    role.actions.forEach((action) => {
      if (!actionMap.has(action.name)) {
        actionMap.set(action.name, {
          name: action.name,
          description: action.description,
        });
      }
    });
  });

  // Also add actions that might not be in roles
  const standaloneActions = [
    new WriteMRD(),
    new WritePRD(),
    new WriteDesign(),
    new WriteSubProjectDesign(),
    new WriteCode(),
    new WriteTest(),
    new WriteTestPlan(),
    new MRDReview(),
    new PRDReview(),
    new DesignReview(),
    new SubProjectDesignReview(),
    new CodeReview(),
    new TestCaseReview(),
    new TestReview(),
    new ImprovePRD(),
    new ImproveMRD(),
    new ImproveDesign(),
    new ImproveTest(),
    new BreakdownTasks(),
    new ExecuteSubtask(),
    new RunCode(),
    new FixBug(),
    new TestabilityReview(),
    new AutomationPlanning(),
    new AutomationExecution(),
    new CoverageQualityCheck(),
    new QAConclusion(),
    new SearchEnhancedQA(),
    new DataAnalysis(),
    new Coordinate(),
  ];

  standaloneActions.forEach((action) => {
    if (!actionMap.has(action.name)) {
      actionMap.set(action.name, {
        name: action.name,
        description: action.description,
      });
    }
  });

  logger.info('   📝 Initializing action definitions...');

  for (const [actionName, actionData] of actionMap.entries()) {
    try {
      // Check if action already exists
      const existing = await actionDefRepo.findByName(actionName);
      if (existing) {
        logger.info(`   ⏭️  Action ${actionName} already exists, skipping`);
        continue;
      }

      // Find the class name
      let className = actionName;
      const actionInstance = standaloneActions.find((a) => a.name === actionName);
      if (actionInstance) {
        className = actionInstance.constructor.name;
      }

      await actionDefRepo.create({
        name: actionName,
        display_name: ACTION_DISPLAY_NAMES[actionName] || actionName,
        description: actionData.description,
        class_name: className,
        category: ACTION_CATEGORIES[actionName] || 'other',
        is_active: true,
      });

      logger.info(`   ✅ Created action definition: ${actionName}`);
    } catch (error: any) {
      logger.error(`   ❌ Failed to create action ${actionName}:`, error.message);
      throw error;
    }
  }

  logger.info(`   ✅ Initialized ${actionMap.size} action definitions`);
}

async function createDefaultWorkflow(applicationId: string) {
  const workflowRepo = new ApplicationWorkflowRepository();

  // Check if default workflow already exists
  const existing = await workflowRepo.findDefaultByApplicationId(applicationId);
  if (existing) {
    logger.info(`   ⏭️  Default workflow already exists for application ${applicationId}, skipping`);
    return existing;
  }

  // Create default workflow based on the current hardcoded workflow
  const defaultWorkflowConfig = {
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
        name: 'ProductManager',
        order: 1,
        actions: ['WritePRD', 'PRDReview', 'ImprovePRD'],
        watch_actions: ['WriteMRD'],
      },
      {
        profile: 'Architect',
        name: 'Architect',
        order: 2,
        actions: ['WriteDesign', 'DesignReview', 'ImproveDesign'],
        watch_actions: ['WritePRD'],
      },
      {
        profile: 'ProjectManager',
        name: 'ProjectManager',
        order: 3,
        actions: ['BreakdownTasks'],
        watch_actions: ['WritePRD'],
      },
      {
        profile: 'Engineer',
        name: 'Engineer',
        order: 4,
        actions: ['WriteCode'],
        watch_actions: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
      },
      {
        profile: 'QAEngineer',
        name: 'QAEngineer',
        order: 5,
        actions: [
          'TestabilityReview',
          'WriteTestPlan',
          'WriteTest',
          'TestCaseReview',
          'AutomationPlanning',
          'AutomationExecution',
          'CoverageQualityCheck',
          'QAConclusion',
        ],
        watch_actions: ['WritePRD', 'WriteCode'],
      },
    ],
  };

  const workflow = await workflowRepo.create({
    applicationId,
    name: '默认工作流',
    description: '默认的完整工作流，包含从需求收集到QA的完整流程',
    isDefault: true,
    workflowConfig: defaultWorkflowConfig,
  });

  logger.info(`   ✅ Created default workflow for application ${applicationId}`);
  return workflow;
}

async function initDefaultWorkflowTemplate() {
  const templateRepo = new SystemDefaultWorkflowTemplateRepository();

  // Check if default template already exists
  const existing = await templateRepo.findByName('default');
  if (existing) {
    logger.info('   ⏭️  Default workflow template already exists, skipping');
    return existing;
  }

  // Default workflow configuration (same as DEFAULT_WORKFLOW_CONFIG in WorkflowService)
  const defaultWorkflowConfig: WorkflowConfig = {
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
        name: 'ProductManager',
        order: 1,
        actions: ['WritePRD', 'PRDReview', 'ImprovePRD'],
        watch_actions: ['WriteMRD'],
      },
      {
        profile: 'Architect',
        name: 'Architect',
        order: 2,
        actions: ['WriteDesign', 'DesignReview', 'ImproveDesign'],
        watch_actions: ['WritePRD'],
      },
      {
        profile: 'ProjectManager',
        name: 'ProjectManager',
        order: 3,
        actions: ['BreakdownTasks'],
        watch_actions: ['WritePRD'],
      },
      {
        profile: 'Engineer',
        name: 'Engineer',
        order: 4,
        actions: ['WriteCode'],
        watch_actions: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
      },
      {
        profile: 'QAEngineer',
        name: 'QAEngineer',
        order: 5,
        actions: [
          'TestabilityReview',
          'WriteTestPlan',
          'WriteTest',
          'TestCaseReview',
          'AutomationPlanning',
          'AutomationExecution',
          'CoverageQualityCheck',
          'QAConclusion',
        ],
        watch_actions: ['WritePRD', 'WriteCode'],
      },
    ],
  };

  const template = await templateRepo.create({
    name: 'default',
    workflowConfig: defaultWorkflowConfig,
    description: '默认的完整工作流，包含从需求收集到QA的完整流程',
    isActive: true,
  });

  logger.info('   ✅ Created default workflow template');
  return template;
}

async function initRoleActionDefinitions() {
  try {
    await connectDatabase();
    logger.info('🔄 Initializing role and action definitions...');

    // Initialize role definitions
    await initRoleDefinitions();

    // Initialize action definitions
    await initActionDefinitions();

    // Initialize default workflow template
    logger.info('   📝 Initializing default workflow template...');
    await initDefaultWorkflowTemplate();

    logger.info('✅ Role and action definitions initialized successfully');
  } catch (error: any) {
    logger.error('❌ Failed to initialize role and action definitions:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

// Export for use in migration runner
export { initRoleActionDefinitions, createDefaultWorkflow, initDefaultWorkflowTemplate };

// Run if executed directly
if (require.main === module) {
  initRoleActionDefinitions()
    .then(() => {
      logger.info('✅ Initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Initialization failed:', error);
      process.exit(1);
    });
}
