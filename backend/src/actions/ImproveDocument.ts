/**
 * ImproveDocument Action
 * Improves PRD or MRD documents based on review reports
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_IMPROVE_SYSTEM_PROMPT,
  buildPRDImprovePrompt,
} from '../prompts/prd';
import {
  MRD_IMPROVE_SYSTEM_PROMPT,
  buildMRDImprovePrompt,
} from '../prompts/mrd';
import { logger, loadPrompt } from '../utils';
import { WorkspaceManager } from '../utils/WorkspaceManager';

export interface ImproveDocumentOptions {
  documentType: 'PRD' | 'MRD' | 'DESIGN';
  reviewReport?: string; // 审查报告内容，如果不提供则从workspace读取
  applicationId?: string;
  projectId?: string;
  version?: number;
  workspacePath?: string;
}

export class ImproveDocument extends BaseAction {
  constructor() {
    super('ImproveDocument', 'Improve PRD or MRD documents based on review reports');
  }

  async run(
    input: string, // 审查报告内容或文档类型标识
    options?: ImproveDocumentOptions
  ): Promise<IActionOutput> {
    // 确定文档类型
    const documentType = options?.documentType || this.detectDocumentType(input);
    
    if (!documentType || (documentType !== 'PRD' && documentType !== 'MRD' && documentType !== 'DESIGN')) {
      throw new Error('Document type must be PRD, MRD, or DESIGN');
    }

    // applicationId 必须提供，不能使用 'default'
    if (!options?.applicationId) {
      throw new Error('applicationId is required for ImproveDocument action. Cannot use "default" to prevent file conflicts between different applications.');
    }
    const applicationId = options.applicationId;
    const version = options?.version || 1;

    logger.info('ImproveDocument: Starting document improvement', {
      documentType,
      applicationId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
    });

    try {
      // Step 1: 读取当前文档
      const currentDocument = await this.readCurrentDocument(documentType, {
        applicationId,
        version,
        documentType,
        workspacePath: options?.workspacePath,
      });

      if (!currentDocument) {
        throw new Error(
          `Cannot find ${documentType} document in workspace. Please generate it first.`
        );
      }

      // Step 2: 读取审查报告
      // 如果输入本身就是审查报告内容，优先使用输入
      let reviewReport = options?.reviewReport;
      
      // 如果没有提供审查报告，尝试从workspace读取
      if (!reviewReport) {
        // 检查输入是否看起来像审查报告（包含"审查报告"关键字）
        if (input && (input.includes('审查报告') || input.includes('改进建议'))) {
          reviewReport = input;
          logger.info('ImproveDocument: Using input as review report', {
            inputLength: input.length,
          });
        } else {
          // 从workspace读取审查报告
          reviewReport = await this.readReviewReport(
            documentType,
            {
              applicationId,
              version,
              documentType,
              workspacePath: options?.workspacePath,
            }
          );
        }
      }

      if (!reviewReport) {
        throw new Error(
          `Cannot find review report for ${documentType}. Please provide review report as input or run review first.`
        );
      }

      logger.info('ImproveDocument: Loaded documents', {
        documentLength: currentDocument.length,
        reviewReportLength: reviewReport.length,
      });

      // Step 3: 从当前文档中移除审查报告部分（如果存在），只保留原始文档内容
      const cleanDocument = this.removeReviewReport(currentDocument, documentType);
      
      // Step 4: 根据审查报告改进文档
      let improvedDocument = await this.improveDocument(
        cleanDocument,
        reviewReport,
        documentType
      );

      // Step 5: 确保改进后的文档不包含审查报告部分（再次移除，以防LLM在改进时添加了审查报告）
      improvedDocument = this.removeReviewReport(improvedDocument, documentType);

      // Step 6: 保存改进后的文档
      const mainFileName = documentType === 'PRD' 
        ? 'PRD.md' 
        : documentType === 'MRD'
        ? 'MRD.md'
        : 'DESIGN.md';
      await this.saveToWorkspace(mainFileName, improvedDocument, {
        applicationId,
        version,
        documentType,
        workspacePath: options?.workspacePath,
      });

      logger.info('ImproveDocument: Document improved and saved', {
        documentType,
        improvedLength: improvedDocument.length,
        mainFileName,
      });

      return {
        content: improvedDocument,
        data: {
          type: `${documentType.toLowerCase()}_improved`,
          documentType,
          timestamp: new Date().toISOString(),
          originalLength: currentDocument.length,
          improvedLength: improvedDocument.length,
        },
      };
    } catch (error: any) {
      logger.error('ImproveDocument: Failed to improve document', {
        documentType,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 检测文档类型
   */
  private detectDocumentType(input: string): 'PRD' | 'MRD' | 'DESIGN' | null {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('prd') || lowerInput.includes('产品需求')) {
      return 'PRD';
    }
    if (lowerInput.includes('mrd') || lowerInput.includes('市场研究')) {
      return 'MRD';
    }
    if (lowerInput.includes('design') || lowerInput.includes('设计') || lowerInput.includes('系统设计')) {
      return 'DESIGN';
    }
    return null;
  }

  /**
   * 读取当前文档
   */
  private async readCurrentDocument(
    documentType: 'PRD' | 'MRD' | 'DESIGN',
    options: any
  ): Promise<string | null> {
    const mainFileName = documentType === 'PRD' 
      ? 'PRD.md' 
      : documentType === 'MRD' 
      ? 'MRD.md' 
      : 'DESIGN.md';
    return await this.readWorkspaceFile(mainFileName, options);
  }

  /**
   * 读取审查报告
   */
  private async readReviewReport(
    documentType: 'PRD' | 'MRD' | 'DESIGN',
    options: any
  ): Promise<string | null> {
    // 尝试读取审查报告文件
    const reviewFileName = documentType === 'PRD' 
      ? 'PRD-review.md' 
      : documentType === 'MRD'
      ? 'MRD-review.md'
      : 'DESIGN-review.md';
    
    let reviewReport = await this.readWorkspaceFile(reviewFileName, options);
    
    // 如果找不到审查报告文件，尝试从主文档末尾提取（有些审查报告会附加在文档末尾）
    if (!reviewReport) {
      const mainDocument = await this.readCurrentDocument(documentType, options);
      if (mainDocument) {
        // 尝试提取审查报告部分（通常在文档末尾，以"---"分隔，然后以审查报告标题开头）
        // 匹配模式：--- 分隔符后的审查报告
        let reviewPattern: RegExp;
        let simplePattern: RegExp;
        
        if (documentType === 'PRD') {
          reviewPattern = /---\s*\n\s*#\s*PRD\s*审查报告[\s\S]*$/;
          simplePattern = /#\s*PRD\s*审查报告[\s\S]*$/;
        } else if (documentType === 'MRD') {
          reviewPattern = /---\s*\n\s*#\s*市场研究文档\s*审查报告[\s\S]*$/;
          simplePattern = /#\s*市场研究文档\s*审查报告[\s\S]*$/;
        } else {
          reviewPattern = /---\s*\n\s*#\s*系统设计文档\s*审查报告[\s\S]*$/;
          simplePattern = /#\s*系统设计文档\s*审查报告[\s\S]*$/;
        }
        
        const reviewMatch = mainDocument.match(reviewPattern);
        if (reviewMatch) {
          // 移除开头的 "---" 分隔符
          reviewReport = reviewMatch[0].replace(/^---\s*\n\s*/, '');
        } else {
          // 如果没有找到分隔符，尝试直接匹配审查报告标题
          const simpleMatch = mainDocument.match(simplePattern);
          if (simpleMatch) {
            reviewReport = simpleMatch[0];
          }
        }
      }
    }
    
    return reviewReport;
  }

  /**
   * 改进文档
   */
  private async improveDocument(
    currentDocument: string,
    reviewReport: string,
    documentType: 'PRD' | 'MRD' | 'DESIGN'
  ): Promise<string> {
    // 选择对应的prompt和system prompt
    let systemPrompt: string;
    let buildPrompt: (doc: string, review: string) => string;
    let promptKey: string;

    if (documentType === 'PRD') {
      systemPrompt = PRD_IMPROVE_SYSTEM_PROMPT;
      buildPrompt = buildPRDImprovePrompt;
      promptKey = 'prd';
    } else if (documentType === 'MRD') {
      systemPrompt = MRD_IMPROVE_SYSTEM_PROMPT;
      buildPrompt = buildMRDImprovePrompt;
      promptKey = 'mrd';
    } else {
      // DESIGN 类型暂时使用通用的改进逻辑
      // TODO: 创建专门的 DESIGN_IMPROVE_SYSTEM_PROMPT 和 buildDesignImprovePrompt
      systemPrompt = `你是一位资深的系统架构改进专家，擅长根据审查报告的建议，补充和完善系统设计文档。

你的职责是：
- 仔细分析审查报告中的改进建议
- 识别文档中需要补充和完善的部分
- 针对性地改进文档内容，使其更加详细、具体、可执行
- 保持文档的原有结构和格式
- 确保改进后的内容符合系统设计文档模板要求

改进原则：
- 保持文档的章节结构和编号不变
- 根据审查报告中的具体建议，补充缺失的内容
- 完善模糊或简略的描述，使其更加详细具体
- 确保技术选型明确，前后端方案完整
- 改进后的内容要面向研发团队，确保可直接使用`;
      
      buildPrompt = (doc: string, review: string) => `请根据以下审查报告的建议，改进和完善系统设计文档：

【当前设计文档】
${doc}

【审查报告】
${review}

改进要求：
1. **仔细分析审查报告**：识别所有改进建议和问题点
2. **保持文档结构**：不要改变章节编号和标题，只改进内容
3. **针对性改进**：
   - 补充缺失的章节内容
   - 完善简略或模糊的描述
   - 明确技术选型并说明理由
   - 完善前后端技术方案，确保目录结构和文件清单完整
   - 细化API设计和数据模型设计
4. **内容质量**：
   - 所有内容必须详细、具体、可执行
   - 避免空洞、模糊或占位符内容
   - 确保研发团队可直接使用
5. **保持格式**：使用Markdown格式，保持章节层级清晰

输出要求：
- 输出完整的改进后的设计文档
- 保持所有章节（## 1. 到 ## 12.）
- 确保改进后的内容解决了审查报告中提出的所有问题`;
      
      promptKey = 'design';
    }

    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const loadedSystemPrompt = await loadPrompt(
      userId,
      promptKey,
      'improve_system_prompt',
      systemPrompt
    );

    // 构建改进提示词
    const prompt = buildPrompt(currentDocument, reviewReport);

    // 调用LLM改进文档
    const improvedDocument = await this.aask(prompt, [loadedSystemPrompt]);

    logger.info('ImproveDocument: Document improved by LLM', {
      documentType,
      improvedLength: improvedDocument.length,
    });

    return improvedDocument;
  }

  /**
   * 从文档中移除审查报告部分
   */
  private removeReviewReport(
    document: string,
    documentType: 'PRD' | 'MRD' | 'DESIGN'
  ): string {
    // 定义审查报告的标题模式
    const reviewTitlePattern = documentType === 'PRD'
      ? /#\s*PRD\s*审查报告/
      : documentType === 'MRD'
      ? /#\s*市场研究文档\s*审查报告/
      : /#\s*系统设计文档\s*审查报告/;
    
    // 查找审查报告标题的位置
    const titleMatchIndex = document.search(reviewTitlePattern);
    
    if (titleMatchIndex === -1) {
      // 如果没有找到审查报告标题，返回原文档
      return document;
    }
    
    // 获取审查报告标题之前的内容
    const beforeTitle = document.substring(0, titleMatchIndex);
    
    // 查找最后一个 "---" 分隔符（审查报告通常用 "---" 分隔）
    // 从后往前查找，找到最后一个独立的 "---" 行
    const lines = beforeTitle.split('\n');
    let lastSeparatorIndex = -1;
    
    // 从后往前查找最后一个 "---" 分隔符
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '---') {
        lastSeparatorIndex = i;
        break;
      }
    }
    
    if (lastSeparatorIndex >= 0) {
      // 如果找到了分隔符，返回分隔符之前的内容（移除分隔符本身）
      const result = lines.slice(0, lastSeparatorIndex).join('\n').trim();
      return result;
    } else {
      // 如果没有找到分隔符，返回审查报告标题之前的内容
      return beforeTitle.trim();
    }
  }
}

export default ImproveDocument;

