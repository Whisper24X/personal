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
import { TestReview } from '../actions/TestReview';
import { ImproveTest } from '../actions/ImproveTest';

export class QAEngineer extends Role {
  constructor(context: Context, name: string = 'QAEngineer') {
    const config: IRoleConfig = {
      name,
      profile: 'QAEngineer',
      goal: 'Execute QA workflow from test planning to test case review and improvement, ensuring quality and functional correctness',
      constraints: 'Focus on code quality, functional correctness, comprehensive test coverage, and systematic QA process. Execute QA workflow in order: test plan -> test cases -> test review -> test improvement',
      description: 'Experienced QA engineer who executes QA workflow including test planning, test case design, review, and improvement',
    };

    super(config, context);

    // Watch for PRD completion (from ProductManager) - moved before Engineer in workflow
    this.watch([ACTION_WRITE_PRD, ACTION_IMPROVE_PRD]);

    // Set actions in order: 4-step QA workflow (参考ProductManager模式)
    this.setActions([
      new WriteTestPlan(), // Step 1: 制定测试计划
      new WriteTest(), // Step 2: 测试用例生成
      new TestReview(), // Step 3: 测试用例审核
      new ImproveTest(), // Step 4: 基于审核报告改善测试用例
    ]);
  }
}

