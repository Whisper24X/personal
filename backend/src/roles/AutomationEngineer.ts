/**
 * Automation Engineer Role
 * Responsible for automation test planning, execution, coverage quality check and QA conclusion
 */

import {
  IRoleConfig,
  ACTION_TEST_CASE_REVIEW,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { AutomationPlanning } from '../actions/AutomationPlanning';
import { AutomationExecution } from '../actions/AutomationExecution';
import { CoverageQualityCheck } from '../actions/CoverageQualityCheck';
import { QAConclusion } from '../actions/QAConclusion';

export class AutomationEngineer extends Role {
  constructor(context: Context, name: string = 'AutomationEngineer') {
    const config: IRoleConfig = {
      name,
      profile: 'AutomationEngineer',
      goal: 'Execute automation test workflow including planning, execution, coverage quality check and final QA conclusion',
      constraints: 'Focus on automation feasibility assessment, technology selection, test execution, coverage analysis and QA conclusion. Execute automation workflow in order: automation planning -> automation execution -> coverage quality check -> QA conclusion',
      description: 'Experienced automation engineer who handles automation test planning, execution, coverage quality analysis and final QA conclusion',
    };

    super(config, context);

    // Watch for test case review completion (from QAEngineer)
    this.watch([ACTION_TEST_CASE_REVIEW]);

    // Set actions in order: 4-step automation workflow
    this.setActions([
      new AutomationPlanning(), // Step 1: 自动化测试拆解与评估
      new AutomationExecution(), // Step 2: 自动化用例实现与执行
      new CoverageQualityCheck(), // Step 3: 测试覆盖率与质量自检
      new QAConclusion(), // Step 4: 给出 QA 结论
    ]);
  }
}

export default AutomationEngineer;
