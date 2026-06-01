/**
 * DataAnalysis Action
 * Performs data analysis and generates analysis code with visualization
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger } from '../utils';

const DATA_ANALYSIS_SYSTEM_PROMPT = `你是一位专业的数据分析师，擅长数据分析和可视化。

你的角色是根据数据需求，生成分析代码和可视化结果。

主要职责：
- 理解数据分析需求
- 生成完整的数据分析代码
- 创建数据可视化图表
- 提供数据洞察和结论

输出格式：包含分析代码、可视化代码和结果解释的完整文档。`;

export class DataAnalysis extends BaseAction {
  constructor() {
    super(
      'DataAnalysis',
      'Perform data analysis and generate analysis code with visualization. Analyze data requirements and generate complete analysis code with visualizations'
    );
  }

  async run(dataRequirement: string): Promise<IActionOutput> {
    logger.info('DataAnalysis: Starting data analysis');
    
    if (!dataRequirement || dataRequirement.trim() === '') {
      throw new Error('未提供数据分析需求');
    }

    try {
      // Build the prompt for data analysis
      const prompt = this.buildAnalysisPrompt(dataRequirement);
      
      // Call LLM with system message and prompt
      const analysisResult = await this.aask(prompt, [DATA_ANALYSIS_SYSTEM_PROMPT]);
      
      logger.info('DataAnalysis: Analysis completed', {
        requirementLength: dataRequirement.length,
        resultLength: analysisResult.length,
      });
      
      return {
        content: analysisResult,
        data: {
          type: 'data_analysis',
          requirement: dataRequirement,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('DataAnalysis: Failed to perform analysis', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(requirement: string): string {
    return `请基于以下数据分析需求，生成完整的数据分析代码和可视化：

数据分析需求：
${requirement}

请提供：
1. **数据加载代码**：如何加载和处理数据
2. **数据分析代码**：完整的数据分析逻辑
3. **可视化代码**：生成图表和可视化的代码
4. **结果解释**：分析结果的解释和洞察

**代码要求**：
- 使用 Python（推荐 pandas, matplotlib, seaborn）或 JavaScript（推荐 D3.js, Chart.js）
- 代码要完整可运行，包含所有必要的导入和依赖
- 包含数据清洗、处理、分析和可视化的完整流程
- 添加详细的注释说明

**可视化要求**：
- 至少包含 3-5 种不同类型的图表
- 图表要清晰、美观、有信息量
- 包含图表的标题、标签和图例

**输出格式**：
使用以下格式输出代码文件：

\`\`\`
===== FILE: analysis.py =====
[数据分析代码]
===== END FILE =====

===== FILE: visualization.py =====
[可视化代码]
===== END FILE =====

===== FILE: requirements.txt =====
[依赖列表]
===== END FILE =====
\`\`\`

**重要要求**：
- 代码必须完整可运行，不能有省略或占位符
- 至少生成 3-5 个代码文件
- 包含完整的数据分析流程
- 提供清晰的结果解释和洞察

请使用 Markdown 格式输出完整的分析文档。`;
  }
}

export default DataAnalysis;

