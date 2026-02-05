/**
 * Automation Engineer Role
 * Responsible for automation test planning and execution (two-step workflow)
 */

import {
  IRoleConfig,
  ACTION_TEST_REVIEW,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { AutomationPlanning } from '../actions/AutomationPlanning';
import { AutomationExecution } from '../actions/AutomationExecution';

export class AutomationEngineer extends Role {
  constructor(context: Context, name: string = 'AutomationEngineer') {
    const config: IRoleConfig = {
      name,
      profile: 'AutomationEngineer',
      goal: '规划自动化测试方案并执行自动化测试',
      constraints: '自动化方案需可维护、可扩展；测试执行需稳定可靠',
      description: '负责自动化测试。监听QAEngineer的测试改进输出，规划自动化测试方案并执行自动化测试。',
    };

    super(config, context);

    // Watch for test review completion (from QAEngineer)
    this.watch([ACTION_TEST_REVIEW]);

    // Set actions in order: 2-step automation workflow
    this.setActions([
      new AutomationPlanning(), // Step 1: 自动化测试拆解与评估
      new AutomationExecution(), // Step 2: 自动化用例实现与执行
    ]);
  }
}

export default AutomationEngineer;
