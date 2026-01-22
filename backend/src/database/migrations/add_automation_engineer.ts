/**
 * Add AutomationEngineer Role Migration
 * 
 * This migration:
 * 1. Adds AutomationEngineer role definition to role_definitions table
 * 2. Updates QAEngineer role to remove automation-related actions
 * 3. Updates the default workflow template to include AutomationEngineer
 * 
 * Run with: npx ts-node src/database/migrations/add_automation_engineer.ts
 */

import { connectDatabase, disconnectDatabase } from '../client';
import { RoleDefinitionRepository } from '../repositories/RoleDefinitionRepository';
import { SystemDefaultWorkflowTemplateRepository } from '../repositories/SystemDefaultWorkflowTemplateRepository';
import { logger } from '../../utils';
import { getDefaultWorkflowConfig } from './init_role_action_definitions';

async function addAutomationEngineerRole() {
  const roleDefRepo = new RoleDefinitionRepository();

  // Check if AutomationEngineer already exists
  const existing = await roleDefRepo.findByProfile('AutomationEngineer');
  if (existing) {
    logger.info('   ⏭️  AutomationEngineer role already exists, skipping creation');
    return;
  }

  // Create AutomationEngineer role definition
  await roleDefRepo.create({
    profile: 'AutomationEngineer',
    name: 'AutomationEngineer',
    display_name: '自动化工程师',
    goal: 'Execute automation test workflow including planning, execution, coverage quality check and final QA conclusion',
    constraints: 'Focus on automation feasibility assessment, technology selection, test execution, coverage analysis and QA conclusion. Execute automation workflow in order: automation planning -> automation execution -> coverage quality check -> QA conclusion',
    description: 'Experienced automation engineer who handles automation test planning, execution, coverage quality analysis and final QA conclusion',
    class_name: 'AutomationEngineer',
    is_active: true,
  });

  logger.info('   ✅ Created AutomationEngineer role definition');
}

async function updateQAEngineerRole() {
  const roleDefRepo = new RoleDefinitionRepository();

  // Find QAEngineer role
  const qaEngineer = await roleDefRepo.findByProfile('QAEngineer');
  if (!qaEngineer) {
    logger.warn('   ⚠️  QAEngineer role not found, skipping update');
    return;
  }

  // Update QAEngineer goal and constraints to reflect new scope
  await roleDefRepo.update('QAEngineer', {
    goal: 'Execute QA workflow from testability review to test case review, ensuring quality and functional correctness',
    constraints: 'Focus on code quality, functional correctness, comprehensive test coverage, and systematic QA process. Execute QA workflow in order: testability review -> test plan -> test cases -> test case review',
    description: 'Experienced QA engineer who executes QA workflow including testability review, test planning, and test case design',
  });

  logger.info('   ✅ Updated QAEngineer role definition');
}

async function updateDefaultWorkflowTemplate() {
  const templateRepo = new SystemDefaultWorkflowTemplateRepository();

  // Find the default template
  const template = await templateRepo.findByName('default');
  if (!template) {
    logger.warn('   ⚠️  Default workflow template not found, will be created on next init');
    return;
  }

  // Update with new workflow config that includes AutomationEngineer
  await templateRepo.update(template.id, {
    workflowConfig: getDefaultWorkflowConfig(),
    description: '默认的完整工作流，包含从需求收集到QA和自动化测试的完整流程',
  });

  logger.info('   ✅ Updated default workflow template with AutomationEngineer');
}

async function runMigration() {
  try {
    await connectDatabase();
    logger.info('🔄 Running AutomationEngineer migration...');

    // Step 1: Add AutomationEngineer role
    logger.info('   📝 Adding AutomationEngineer role...');
    await addAutomationEngineerRole();

    // Step 2: Update QAEngineer role
    logger.info('   📝 Updating QAEngineer role...');
    await updateQAEngineerRole();

    // Step 3: Update default workflow template
    logger.info('   📝 Updating default workflow template...');
    await updateDefaultWorkflowTemplate();

    logger.info('✅ AutomationEngineer migration completed successfully');
  } catch (error: any) {
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

// Export for use in migration runner
export { runMigration, addAutomationEngineerRole, updateQAEngineerRole, updateDefaultWorkflowTemplate };

// Run if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      logger.info('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
