/**
 * Salesperson Role
 * 负责需求收集和市场调研
 */

import { IRoleConfig, ACTION_USER_REQUIREMENT } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteRequirementSpec } from '../actions/WriteRequirementSpec';

export class Salesperson extends Role {
  constructor(context: Context, name: string = 'Salesperson') {
    const config: IRoleConfig = {
      name,
      profile: 'Salesperson',
      goal: '需求收集专家，负责收集和分析用户需求，输出需求说明文档',
      constraints: '深入理解用户需求，进行市场调研和可行性分析',
      description: '我是一名专业的需求收集专家，擅长与客户沟通，深入理解用户需求，并将其转化为清晰的需求说明文档。',
    };
    
    super(config, context);
    
    // Watch for user requirements
    this.watch([ACTION_USER_REQUIREMENT]);
    
    this.setActions([new WriteRequirementSpec()]);
  }
}

