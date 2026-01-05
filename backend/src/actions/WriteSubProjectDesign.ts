/**
 * WriteSubProjectDesign Action
 * Generates sub-project design documents based on task breakdown
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  SUB_PROJECT_DESIGN_SYSTEM_PROMPT,
  buildSubProjectDesignPrompt,
} from '../prompts/task';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';
import { SubProjectDesignReview } from './SubProjectDesignReview';
import { ImproveDocument } from './ImproveDocument';

export interface WriteSubProjectDesignOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
  autoReview?: boolean; // 是否自动审查，默认为 true
  autoImprove?: boolean; // 是否自动改进，默认为 true
}

export class WriteSubProjectDesign extends BaseAction {
  constructor() {
    super('WriteSubProjectDesign', 'Generate sub-project design documents');
  }

  async run(
    taskBreakdown: string,
    design: string,
    options?: WriteSubProjectDesignOptions
  ): Promise<IActionOutput> {
    const autoReview = options?.autoReview !== false; // 默认启用审查
    const autoImprove = options?.autoImprove !== false; // 默认启用改进

    logger.info('WriteSubProjectDesign: Starting sub-project design generation', {
      autoReview,
      autoImprove,
      taskBreakdownLength: taskBreakdown.length,
      designLength: design.length,
    });
    
    try {
      // Build the prompt
      const prompt = buildSubProjectDesignPrompt(taskBreakdown, design);
      
      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'design', 'system_prompt', SUB_PROJECT_DESIGN_SYSTEM_PROMPT);
      
      // Call LLM with system message and prompt
      let subProjectDesignContent = await this.aask(prompt, [systemPrompt]);
      
      // 保存到workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'DESIGN',
      };
      await this.saveToWorkspace('SUB_PROJECT_DESIGN.md', subProjectDesignContent, workspaceOptions);
      
      logger.info('WriteSubProjectDesign: Sub-project design generated', {
        contentLength: subProjectDesignContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      // Step 2: 审查（如果启用）
      let reviewReport: string | undefined;
      if (autoReview) {
        const reviewStart = Date.now();
        logger.info('WriteSubProjectDesign: Running review');
        
        try {
          const reviewAction = new SubProjectDesignReview();
          reviewAction.setLLM((this as any).llm);
          if ((this as any).context) {
            reviewAction.setContext((this as any).context);
          }

          const reviewResult = await reviewAction.run(subProjectDesignContent);
          reviewReport = reviewResult.content;

          // 保存审查报告到单独文件
          await this.saveToWorkspace('SUB_PROJECT_DESIGN-review.md', `# 子项目设计文档审查报告\n\n${reviewReport}`, workspaceOptions);

          logger.info('WriteSubProjectDesign: Review completed', {
            reviewLength: reviewReport.length,
            duration: `${Date.now() - reviewStart}ms`,
          });
        } catch (reviewError: any) {
          logger.warn('WriteSubProjectDesign: Review failed, continuing without review', {
            error: reviewError.message,
          });
        }
      }

      // Step 3: 改进（如果启用且审查报告存在）
      if (autoImprove && reviewReport) {
        const improveStart = Date.now();
        logger.info('WriteSubProjectDesign: Running improvement');
        
        try {
          // 直接使用 LLM 改进文档（因为 ImproveDocument 期望 DESIGN.md，而这里是 SUB_PROJECT_DESIGN.md）
          const improvePrompt = `请根据以下审查报告的建议，改进和完善子项目设计文档：

【当前子项目设计文档】
${subProjectDesignContent}

【审查报告】
${reviewReport}

改进要求：
1. **仔细分析审查报告**：识别所有改进建议和问题点
2. **保持文档结构**：不要改变章节编号和标题，只改进内容
3. **针对性改进**：
   - 补充缺失的章节内容
   - 完善简略或模糊的描述
   - 明确技术架构和API设计
   - 完善数据模型设计
   - 确保与整体系统设计保持一致
4. **内容质量**：
   - 所有内容必须详细、具体、可执行
   - 避免空洞、模糊或占位符内容
   - 确保研发团队可直接使用
5. **保持格式**：使用Markdown格式，保持章节层级清晰

输出要求：
- 输出完整的改进后的子项目设计文档
- 确保改进后的内容解决了审查报告中提出的所有问题`;

          const userId = this.context?.get('userId');
          const improveSystemPrompt = await loadPrompt(
            userId,
            'design',
            'improve_system_prompt',
            `你是一位资深的子项目设计改进专家，擅长根据审查报告的建议，补充和完善子项目设计文档。

你的职责是：
- 仔细分析审查报告中的改进建议
- 识别文档中需要补充和完善的部分
- 针对性地改进文档内容，使其更加详细、具体、可执行
- 保持文档的原有结构和格式
- 确保改进后的内容符合子项目设计文档要求

改进原则：
- 保持文档的章节结构和编号不变
- 根据审查报告中的具体建议，补充缺失的内容
- 完善模糊或简略的描述，使其更加详细具体
- 确保技术架构、API设计、数据模型设计完整
- 改进后的内容要面向研发团队，确保可直接使用`
          );

          const improvedContent = await this.aask(improvePrompt, [improveSystemPrompt]);
          subProjectDesignContent = improvedContent;

          // 保存改进后的文档
          await this.saveToWorkspace('SUB_PROJECT_DESIGN.md', subProjectDesignContent, workspaceOptions);

          // 在审查报告中标注已改进
          const improvedMark = '\n\n---\n\n**状态**: ✅ 已根据审查报告完成改进\n\n**改进时间**: ' + new Date().toISOString();
          await this.saveToWorkspace('SUB_PROJECT_DESIGN-review.md', `# 子项目设计文档审查报告\n\n${reviewReport}${improvedMark}`, workspaceOptions);

          logger.info('WriteSubProjectDesign: Improvement completed', {
            originalLength: subProjectDesignContent.length,
            improvedLength: improvedContent.length,
            duration: `${Date.now() - improveStart}ms`,
          });
        } catch (improveError: any) {
          logger.warn('WriteSubProjectDesign: Improvement failed, continuing without improvement', {
            error: improveError.message,
          });
        }
      }
      
      logger.info('WriteSubProjectDesign: Sub-project design generation completed', {
        contentLength: subProjectDesignContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
        reviewIncluded: !!reviewReport,
        improvementIncluded: autoImprove && !!reviewReport,
      });
      
      return {
        content: subProjectDesignContent,
        data: {
          type: 'sub_project_design',
          filename: 'SUB_PROJECT_DESIGN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          reviewIncluded: !!reviewReport,
          improvementIncluded: autoImprove && !!reviewReport,
        },
      };
    } catch (error: any) {
      logger.error('WriteSubProjectDesign: Failed to generate sub-project design', error);
      throw error;
    }
  }
}

export default WriteSubProjectDesign;

