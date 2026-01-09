/**
 * Salesperson Role
 * 负责需求收集和市场调研，生成市场研究文档（MRD）
 */

import { IRoleConfig } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteMRD } from '../actions/WriteMRD';
import { MRDReview } from '../actions/MRDReview';

export class Salesperson extends Role {
  constructor(context: Context, name: string = 'Salesperson') {
    const config: IRoleConfig = {
      name,
      profile: 'Salesperson',
      goal: '需求收集专家，负责收集和分析用户需求，进行市场调研和业务分析，输出市场研究文档（MRD）',
      constraints: '深入理解用户需求，进行市场调研、目标价值分析、需求价值分析和业务流程分析',
      description: '我是一名专业的需求收集和市场研究专家，擅长与客户沟通，深入理解用户需求，进行市场调研和业务分析，并将其转化为清晰的市场研究文档（MRD）。',
    };

    super(config, context);

    // Watch for initial user requirements (User messages)
    // Salesperson is the first role in the workflow, so it needs to listen for User messages
    this.watch(['User']);

    this.setActions([new WriteMRD(), new MRDReview()]);
  }
}

