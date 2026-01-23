/**
 * Initialize Role and Action Definitions
 * Extracts role and action definitions from code registry and inserts into database
 * 
 * Uses RoleActionFactory for dynamic role/action instantiation
 */

import { connectDatabase, disconnectDatabase } from '../client';
import { RoleDefinitionRepository, ActionDefinitionRepository, ApplicationWorkflowRepository, SystemDefaultWorkflowTemplateRepository } from '../repositories';
import { logger } from '../../utils';
import { Context } from '../../core/context/Context';
import { WorkflowConfig } from '../repositories/ApplicationWorkflowRepository';
import { RoleActionFactory } from '../../services/RoleActionFactory';

// Role display names mapping (Chinese) - used for initial seeding
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  Salesperson: '销售',
  ProductManager: '产品经理',
  Architect: '架构师',
  ProjectManager: '项目经理',
  Engineer: '工程师',
  QAEngineer: 'QA工程师',
  AutomationEngineer: '自动化工程师',
  TeamLeader: '团队领导',
  DataAnalyst: '数据分析师',
};

// Action display names mapping (Chinese) - used for initial seeding
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

  // AutomationEngineer actions
  AutomationPlanning: '自动化规划',
  AutomationExecution: '自动化执行',
  CoverageQualityCheck: '覆盖率质量检查',
  QAConclusion: 'QA结论',

  // TeamLeader actions
  Coordinate: '协调工作',

  // DataAnalyst actions
  DataAnalysis: '数据分析',
};

// Action categories - used for initial seeding
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

  // Create role instances using factory
  const roles = RoleActionFactory.createAllRoleInstances(context);

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

  // Collect all actions from roles using factory
  const roles = RoleActionFactory.createAllRoleInstances(context);

  // Collect unique actions from roles
  const actionMap = new Map<string, { name: string; description?: string; className: string }>();
  roles.forEach((role) => {
    role.actions.forEach((action) => {
      if (!actionMap.has(action.name)) {
        actionMap.set(action.name, {
          name: action.name,
          description: action.description,
          className: action.constructor.name,
        });
      }
    });
  });

  // Also add standalone actions from factory
  const standaloneActions = RoleActionFactory.createAllActionInstances();
  standaloneActions.forEach((action) => {
    if (!actionMap.has(action.name)) {
      actionMap.set(action.name, {
        name: action.name,
        description: action.description,
        className: action.constructor.name,
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

      await actionDefRepo.create({
        name: actionName,
        display_name: ACTION_DISPLAY_NAMES[actionName] || actionName,
        description: actionData.description,
        class_name: actionData.className,
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

/**
 * Get the default workflow configuration
 * This is the single source of truth for the default workflow
 */
function getDefaultWorkflowConfig(): WorkflowConfig {
  return {
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
        ],
        watch_actions: ['WritePRD', 'WriteCode'],
      },
      {
        profile: 'AutomationEngineer',
        name: 'AutomationEngineer',
        order: 6,
        actions: [
          'AutomationPlanning',
          'AutomationExecution',
          'CoverageQualityCheck',
          'QAConclusion',
        ],
        watch_actions: ['TestCaseReview'],
      },
    ],
  };
}

async function createDefaultWorkflow(applicationId: string) {
  const workflowRepo = new ApplicationWorkflowRepository();

  // Check if default workflow already exists
  const existing = await workflowRepo.findDefaultByApplicationId(applicationId);
  if (existing) {
    logger.info(`   ⏭️  Default workflow already exists for application ${applicationId}, skipping`);
    return existing;
  }

  const workflow = await workflowRepo.create({
    applicationId,
    name: '默认工作流',
    description: '默认的完整工作流，包含从需求收集到QA的完整流程',
    isDefault: true,
    workflowConfig: getDefaultWorkflowConfig(),
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

  const template = await templateRepo.create({
    name: 'default',
    workflowConfig: getDefaultWorkflowConfig(),
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
export { initRoleActionDefinitions, createDefaultWorkflow, initDefaultWorkflowTemplate, getDefaultWorkflowConfig };

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
