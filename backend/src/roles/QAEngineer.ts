/**
 * QA Engineer Role
 * Responsible for quality assurance and test design workflow
 */

import {
  IRoleConfig,
  ACTION_WRITE_CODE,
  ACTION_WRITE_PRD,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { TestabilityReview } from '../actions/TestabilityReview';
import { WriteTestPlan } from '../actions/WriteTestPlan';
import { WriteTest } from '../actions/WriteTest';
import { TestCaseReview } from '../actions/TestCaseReview';

export class QAEngineer extends Role {
  constructor(context: Context, name: string = 'QAEngineer') {
    const config: IRoleConfig = {
      name,
      profile: 'QAEngineer',
      goal: 'Execute QA workflow from testability review to test case review, ensuring quality and functional correctness',
      constraints: 'Focus on code quality, functional correctness, comprehensive test coverage, and systematic QA process. Execute QA workflow in order: testability review -> test plan -> test cases -> test case review',
      description: 'Experienced QA engineer who executes QA workflow including testability review, test planning, and test case design',
    };

    super(config, context);

    // Watch for PRD and code completion (from ProductManager and Engineer)
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_CODE]);

    // Set actions in order: 4-step QA workflow
    this.setActions([
      new TestabilityReview(), // Step 1: 需求可测性检查
      new WriteTestPlan(), // Step 2: 制定测试计划
      new WriteTest(), // Step 3: 测试用例生成
      new TestCaseReview(), // Step 4: 用例评审与补充
    ]);
  }
}

