/**
 * QA Engineer Role
 * Responsible for quality assurance and test case writing
 */

import { IRoleConfig, ACTION_WRITE_CODE } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteTest } from '../actions/WriteTest';

export class QAEngineer extends Role {
  constructor(context: Context, name: string = 'QAEngineer') {
    const config: IRoleConfig = {
      name,
      profile: 'QAEngineer',
      goal: 'Write comprehensive test cases based on code implementation to ensure quality and functional correctness',
      constraints: 'Focus on code quality, functional correctness, and comprehensive test coverage. Write unit tests and integration tests',
      description: 'Experienced QA engineer who writes comprehensive test cases based on code implementation to ensure quality and functional correctness',
    };

    super(config, context);

    // Watch for code completion (from Engineer)
    this.watch([ACTION_WRITE_CODE]);

    this.setActions([new WriteTest()]);
  }
}

