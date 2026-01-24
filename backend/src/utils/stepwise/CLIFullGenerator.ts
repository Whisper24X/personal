/**
 * CLIFullGenerator
 * CLI 完整文档生成器
 * 适用于 CLI 模式，一次性生成完整文档，避免产生大量中间文件
 */

import { IActionOutput } from '@mind2build/shared';
import { logger } from '../logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseGenerator } from './BaseGenerator';
import { StepState } from './types';
import { buildCLISaveInstruction } from './workspaceUtils';

/**
 * CLI Full Document Generator
 * Generates complete documents in a single pass (no stepwise generation)
 */
export class CLIFullGenerator extends BaseGenerator {
  /**
   * CLI模式：直接生成完整文档（跳过分章节）
   * 适用于CLI模式，避免产生大量中间文件
   */
  async generate(input: string): Promise<IActionOutput> {
    // Reset cancellation flag when starting new generation
    this.isCancelled = false;
    
    const startTime = Date.now();
    const logContext = this.getLogContext();

    logger.info('CLIFullGenerator: Starting full document generation', {
      ...logContext,
      documentType: this.config.documentType,
      documentTitle: this.config.documentTitle,
      workspaceDir: this.config.workspaceDir,
      applicationId: this.config.applicationId,
      projectId: this.config.projectId,
      inputLength: input.length,
    });

    try {
      // Step 0: 初始化工作空间
      await this.initWorkspace();

      await this.checkCancellation();

      // Step 1: 构建完整文档生成提示词
      logger.info('CLIFullGenerator: Generating complete document', logContext);
      await this.setStepState('generate-full', StepState.RUNNING);

      let fullDocumentPrompt: string;
      if (this.config.buildFullDocumentPrompt) {
        // 使用配置的完整文档提示词构建函数
        fullDocumentPrompt = this.config.buildFullDocumentPrompt(input);
      } else {
        // 默认：构建一个简单的完整文档生成提示词
        fullDocumentPrompt = this.buildDefaultFullDocumentPrompt(input);
      }

      // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
      if (this.config.executorMode === 'cli') {
        const savePath = `${this.config.workspaceDir}/${this.config.mainFileName}`;
        const saveInstruction = buildCLISaveInstruction(savePath, '文档');
        fullDocumentPrompt += saveInstruction;
        
        logger.info('CLIFullGenerator: Added CLI save path instruction', {
          ...logContext,
          savePath,
        });
      }

      await this.checkCancellation();

      // Step 2: 调用LLM/CLI生成完整文档
      const cliOutput = await (this.action as any).aask(fullDocumentPrompt, [this.config.systemPrompt]);

      await this.checkCancellation();

      // Step 3: 检查CLI输出是否为操作总结（而非实际文档内容）
      // CLI模式下，Cursor CLI可能返回操作总结而不是实际文档
      let finalContent: string;
      
      if (this.config.executorMode === 'cli' && this.isCLISummaryOutput(cliOutput)) {
        logger.info('CLIFullGenerator: CLI output appears to be a summary, reading actual file from workspace', {
          ...logContext,
          cliOutputLength: cliOutput.length,
          cliOutputPreview: cliOutput.substring(0, 200),
        });
        
        // 尝试从workspace读取CLI实际生成的文件
        const actualContent = await this.tryReadActualDocumentFromWorkspace();
        
        if (actualContent) {
          finalContent = actualContent;
          logger.info('CLIFullGenerator: Successfully read actual document from workspace', {
            ...logContext,
            actualContentLength: actualContent.length,
          });
        } else {
          // 如果找不到实际文件，抛出明确错误而非静默回退到总结内容
          // 这可以防止文档丢失的情况发生（如 DESIGN.md 为空）
          logger.error('CLIFullGenerator: CLI returned summary but actual document not found in workspace', {
            ...logContext,
            expectedFile: `${this.config.workspaceDir}/${this.config.mainFileName}`,
            cliOutputPreview: cliOutput.substring(0, 500),
          });
          throw new Error(
            `CLI模式文档生成失败: CLI返回了操作总结，但在workspace中找不到实际文档。` +
            `预期文件路径: ${this.config.workspaceDir}/${this.config.mainFileName}。` +
            `CLI可能未能保存文件或保存到了错误的位置。`
          );
        }
      } else {
        // LLM模式或CLI输出看起来是实际文档内容
        finalContent = cliOutput.trim();
      }

      // Step 4: 清理内容（移除可能的代码块标记）
      let cleanedContent = finalContent;
      cleanedContent = cleanedContent.replace(/^```(?:markdown|md|text)?\s*\n?/i, '');
      cleanedContent = cleanedContent.replace(/\n?```\s*$/, '');

      // Step 5: 保存到主文件（如果内容看起来是有效文档）
      // 只有当内容不是CLI总结时才保存
      if (!this.isCLISummaryOutput(cleanedContent)) {
        await this.saveToWorkspace(this.config.mainFileName, cleanedContent);
      }
      await this.setStepState('generate-full', StepState.COMPLETED);

      const totalDuration = Date.now() - startTime;

      logger.info('CLIFullGenerator: Complete document generation finished', {
        ...logContext,
        contentLength: cleanedContent.length,
        mainFileName: this.config.mainFileName,
        workspaceDir: this.config.workspaceDir,
        totalDuration: `${totalDuration}ms`,
      });

      return {
        content: cleanedContent,
        data: {
          type: this.config.documentType.toLowerCase(),
          filename: this.config.mainFileName,
          timestamp: new Date().toISOString(),
          mode: 'new',
          stepwise: false, // 非分步骤生成
          fullGeneration: true, // 完整文档生成标记
          workspaceDir: this.config.workspaceDir,
        },
      };
    } catch (error: any) {
      logger.error('CLIFullGenerator: Complete document generation failed', {
        ...logContext,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 检查输出是否为CLI操作总结（而非实际文档内容）
   * CLI工具通常返回操作总结，而不是实际的文档内容
   */
  private isCLISummaryOutput(output: string): boolean {
    if (!output || output.trim().length === 0) return false;
    
    const trimmed = output.trim();
    
    // CLI总结的特征关键词
    const summaryKeywords = [
      '已完成',
      '主要变更如下',
      '改进如下',
      '审查结果',
      '文档已保存',
      '保存至',
      '已生成',
      '生成完成',
    ];
    
    // 检查是否包含总结关键词
    const hasSummaryKeyword = summaryKeywords.some(keyword => trimmed.includes(keyword));
    
    // 检查是否不像一个正式文档（正式文档通常以 # 标题开头）
    const startsWithTitle = /^#\s+/.test(trimmed);
    
    // 检查内容长度（总结通常较短，文档通常较长）
    const isShort = trimmed.length < 1000;
    
    // 如果包含总结关键词，且要么不以标题开头，要么内容很短，则认为是总结
    if (hasSummaryKeyword && (!startsWithTitle || isShort)) {
      return true;
    }
    
    return false;
  }

  /**
   * 尝试从workspace读取CLI实际生成的文档
   * CLI可能将文件保存到不同位置，需要查找最合适的文件
   */
  private async tryReadActualDocumentFromWorkspace(): Promise<string | null> {
    const logContext = this.getLogContext();
    
    try {
      // 检查workspace目录是否存在
      try {
        await fs.access(this.config.workspaceDir);
      } catch {
        logger.warn('CLIFullGenerator: Workspace directory does not exist', {
          ...logContext,
          workspaceDir: this.config.workspaceDir,
        });
        return null;
      }

      // 读取目录中的所有md文件
      const entries = await fs.readdir(this.config.workspaceDir, { withFileTypes: true });
      
      // 筛选md文件，排除review文件、outline文件和section文件
      const documentFiles = entries
        .filter(entry => {
          if (!entry.isFile() || !entry.name.endsWith('.md')) return false;
          // 排除review文件
          if (entry.name.includes('review') || entry.name.includes('Review') || entry.name.includes('REVIEW')) return false;
          // 排除outline文件
          if (entry.name.includes('outline')) return false;
          // 排除section文件
          if (/^\d+-section-/.test(entry.name)) return false;
          return true;
        })
        .map(entry => entry.name);

      logger.info('CLIFullGenerator: Found document files in workspace', {
        ...logContext,
        files: documentFiles,
      });

      // 优先读取主文件
      if (documentFiles.includes(this.config.mainFileName)) {
        const mainFilePath = path.join(this.config.workspaceDir, this.config.mainFileName);
        const content = await fs.readFile(mainFilePath, 'utf-8');
        
        // 检查主文件内容是否为有效文档（不是CLI总结）
        if (content && !this.isCLISummaryOutput(content)) {
          return content;
        }
      }

      // 查找其他可能的文档文件（按修改时间排序，最新的优先）
      const fileStats = await Promise.all(
        documentFiles
          .filter(name => name !== this.config.mainFileName)
          .map(async (name) => {
            const filePath = path.join(this.config.workspaceDir, name);
            const stat = await fs.stat(filePath);
            return { name, filePath, mtime: stat.mtime };
          })
      );

      // 按修改时间降序排序
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 尝试读取最新的文件
      for (const fileStat of fileStats) {
        const content = await fs.readFile(fileStat.filePath, 'utf-8');
        
        // 检查内容是否为有效文档
        if (content && !this.isCLISummaryOutput(content) && content.length > 500) {
          logger.info('CLIFullGenerator: Found actual document in workspace', {
            ...logContext,
            filename: fileStat.name,
            contentLength: content.length,
          });
          return content;
        }
      }

      // 也检查父目录（CLI可能将文件保存到docs目录而不是mrd子目录）
      const parentDir = path.dirname(this.config.workspaceDir);
      try {
        await fs.access(parentDir);
        const parentEntries = await fs.readdir(parentDir, { withFileTypes: true });
        
        const parentDocFiles = parentEntries
          .filter(entry => {
            if (!entry.isFile() || !entry.name.endsWith('.md')) return false;
            // 只查找包含文档类型名称的文件
            const docType = this.config.documentType.toLowerCase();
            return entry.name.toLowerCase().includes(docType);
          })
          .map(entry => entry.name);

        for (const fileName of parentDocFiles) {
          const filePath = path.join(parentDir, fileName);
          const content = await fs.readFile(filePath, 'utf-8');
          
          if (content && !this.isCLISummaryOutput(content) && content.length > 500) {
            logger.info('CLIFullGenerator: Found actual document in parent directory', {
              ...logContext,
              filename: fileName,
              contentLength: content.length,
            });
            return content;
          }
        }
      } catch {
        // 父目录不存在或无法访问，忽略
      }

      return null;
    } catch (error: any) {
      logger.error('CLIFullGenerator: Failed to read actual document from workspace', {
        ...logContext,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 构建默认的完整文档生成提示词
   * 当没有配置 buildFullDocumentPrompt 时使用
   */
  private buildDefaultFullDocumentPrompt(input: string): string {
    const sectionsDescription = this.config.defaultSections
      .map(s => `${s.number}. ${s.title}`)
      .join('\n');

    return `请基于以下输入，生成一份完整的${this.config.documentTitle}。

【输入内容】
${input}

【文档结构要求】
请按照以下章节结构生成完整文档：
${sectionsDescription}

【输出要求】
1. 直接输出完整的Markdown格式文档
2. 每个章节以 "## 章节编号. 章节标题" 格式开头
3. 内容详实、结构清晰
4. 不要输出任何解释性文字，直接输出文档内容`;
  }
}
