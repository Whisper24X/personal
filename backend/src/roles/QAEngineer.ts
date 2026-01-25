/**
 * QA Engineer Role
 * Responsible for quality assurance and test design workflow
 */

import {
  IRoleConfig,
  ACTION_WRITE_PRD,
  ACTION_IMPROVE_PRD,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteTestPlan } from '../actions/WriteTestPlan';
import { WriteTest } from '../actions/WriteTest';
import { TestCaseReview } from '../actions/TestCaseReview';

export class QAEngineer extends Role {
  constructor(context: Context, name: string = 'QAEngineer') {
    const config: IRoleConfig = {
      name,
      profile: 'QAEngineer',
      goal: 'Execute QA workflow from test planning to test case review, ensuring quality and functional correctness',
      constraints: 'Focus on code quality, functional correctness, comprehensive test coverage, and systematic QA process. Execute QA workflow in order: test plan -> test cases -> test case review',
      description: 'Experienced QA engineer who executes QA workflow including test planning and test case design',
    };

    super(config, context);

    // Watch for PRD completion (from ProductManager) - moved before Engineer in workflow
    this.watch([ACTION_WRITE_PRD, ACTION_IMPROVE_PRD]);

    // Set actions in order: 3-step QA workflow
    this.setActions([
      new WriteTestPlan(), // Step 1: 制定测试计划
      new WriteTest(), // Step 2: 测试用例生成
      new TestCaseReview(), // Step 3: 用例评审与补充
    ]);
  }
}

