/**
 * QA Engineer Role
 * 负责质量保证和测试用例编写
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
      goal: '质量保证工程师，负责编写测试用例和执行质量保证',
      constraints: '确保代码质量和功能正确性',
      description: '我是一名专业的QA工程师，擅长编写全面的测试用例，确保代码质量和功能正确性。',
    };
    
    super(config, context);
    
    // Watch for code completion (from Engineer)
    this.watch([ACTION_WRITE_CODE]);
    
    this.setActions([new WriteTest()]);
  }
}

