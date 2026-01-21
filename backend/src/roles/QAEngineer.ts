/**
 * QA Engineer Role
 * Responsible for quality assurance and comprehensive testing workflow
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
import { AutomationPlanning } from '../actions/AutomationPlanning';
import { AutomationExecution } from '../actions/AutomationExecution';
import { CoverageQualityCheck } from '../actions/CoverageQualityCheck';
import { QAConclusion } from '../actions/QAConclusion';

export class QAEngineer extends Role {
  constructor(context: Context, name: string = 'QAEngineer') {
    const config: IRoleConfig = {
      name,
      profile: 'QAEngineer',
      goal: 'Execute comprehensive QA workflow from testability review to final QA conclusion, ensuring quality and functional correctness',
      constraints: 'Focus on code quality, functional correctness, comprehensive test coverage, and systematic QA process. Execute QA workflow in order: testability review -> test plan -> test cases -> test case review -> automation planning -> automation execution -> coverage check -> QA conclusion',
      description: 'Experienced QA engineer who executes comprehensive QA workflow including testability review, test planning, test case design, automation, coverage analysis, and final QA conclusion',
    };

    super(config, context);

    // Watch for PRD and code completion (from ProductManager and Engineer)
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_CODE]);

    // Set actions in order: 9-step QA workflow
    this.setActions([
      new TestabilityReview(), // Step 2: 需求可测性检查
      new WriteTestPlan(), // Step 3: 制定测试计划
      new WriteTest(), // Step 4: 测试用例生成
      new TestCaseReview(), // Step 5: 用例评审与补充
      new AutomationPlanning(), // Step 6: 自动化测试拆解与评估
      new AutomationExecution(), // Step 7: 自动化用例实现与执行
      new CoverageQualityCheck(), // Step 8: 测试覆盖率与质量自检
      new QAConclusion(), // Step 9: 给出 QA 结论
    ]);
  }
}

