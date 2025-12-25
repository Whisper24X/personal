/**
 * Data Analyst Role
 * Performs data analysis and generates analysis code with visualization
 */

import { IRoleConfig, ACTION_USER_REQUIREMENT } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { DataAnalysis } from '../actions/DataAnalysis';

export class DataAnalyst extends Role {
  constructor(context: Context, name: string = 'DataAnalyst') {
    const config: IRoleConfig = {
      name,
      profile: 'DataAnalyst',
      goal: '数据分析师，负责数据分析需求处理，生成分析代码和可视化',
      constraints: '确保分析代码的质量和可视化效果',
      description: '我是一名专业的数据分析师，擅长处理数据分析需求，生成完整的分析代码和数据可视化。',
    };
    
    super(config, context);
    
    // Watch for user requirements or data analysis requests
    // Data Analyst can work independently or based on user requirements
    this.watch([ACTION_USER_REQUIREMENT]);
    
    // Set actions
    this.setActions([new DataAnalysis()]);
  }
}

export default DataAnalyst;

