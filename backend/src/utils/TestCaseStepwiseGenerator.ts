/**
 * TestCaseStepwiseGenerator
 * 分步骤测试用例生成工具类
 * 支持：功能模块列表生成 -> 按模块生成测试用例 -> 评审 -> 改进 -> 合并
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger } from './logger';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Step state enum for logging purposes
 */
enum StepState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TestModule {
  number: number;
  title: string;
  description?: string; // 功能模块的简短描述，用于规范测试用例和引导生成
}

export interface TestCaseStepwiseConfig {
  // Prompt 构建函数
  buildOutlinePrompt: (prd: string, code: string) => string;
  buildSectionPrompt: (
    prd: string,
    code: string,
    outline: string,
    sectionNumber: number,
    sectionTitle: string,
    sectionDescription?: string
  ) => string;
  buildSectionReviewPrompt: (
    sectionContent: string,
    sectionNumber: number,
    sectionTitle: string,
    outline: string,
    prd?: string,
    code?: string,
    sectionDescription?: string
  ) => string;
  buildSectionImprovePrompt: (
    sectionContent: string,
    reviewReport: string,
    sectionNumber: number,
    sectionTitle: string,
    outline: string,
    prd?: string,
    code?: string,
    sectionDescription?: string
  ) => string;
  systemPrompt: string;
  reviewSystemPrompt: string;
  improveSystemPrompt: string;

  // 文档元信息
  documentTitle: string; // 如 "测试用例文档"
  documentType: string; // 如 "TEST"
  mainFileName: string; // 如 "TEST.md"

  // Workspace 配置
  workspaceDir: string;
  applicationId?: string;
  projectId?: string;
  version?: number;

  // 角色名称（可选，用于日志）
  role?: string;

  // PRD 和代码内容
  prd: string;
  code: string;
}

export class TestCaseStepwiseGenerator {
  private action: BaseAction;
  private config: TestCaseStepwiseConfig;
  private abortController?: AbortController;
  private isCancelled: boolean = false;

  constructor(action: BaseAction, config: TestCaseStepwiseConfig) {
    this.action = action;
    this.config = config;
    this.abortController = new AbortController();
  }

  /**
   * 获取日志上下文信息（角色和action名称）
   */
  private getLogContext(): { role?: string; actionName?: string } {
    return {
      role: this.config.role,
      actionName: this.action.name,
    };
  }

  /**
   * 执行分步骤生成
   */
  async generate(): Promise<IActionOutput> {
    // Reset cancellation flag when starting new generation
    this.isCancelled = false;

    const startTime = Date.now();
    const logContext = this.getLogContext();
    logger.info('TestCaseStepwiseGenerator: Starting stepwise test case generation', {
      ...logContext,
      documentType: this.config.documentType,
      documentTitle: this.config.documentTitle,
      workspaceDir: this.config.workspaceDir,
      applicationId: this.config.applicationId,
      version: this.config.version,
      prdLength: this.config.prd.length,
      codeLength: this.config.code.length,
    });

    try {
      // Step 1: 生成功能模块列表（目录）
      const step1Start = Date.now();
      logger.info('TestCaseStepwiseGenerator: Step 1/7 - Generating test modules outline', logContext);
      await this.checkCancellation();
      await this.setStepState('outline', StepState.RUNNING);
      const outline = await this.generateOutline();
      await this.saveToWorkspace('00-outline.md', outline);
      await this.setStepState('outline', StepState.COMPLETED);
      logger.info('TestCaseStepwiseGenerator: Step 1/7 completed - Outline generated', {
        ...logContext,
        outlineLength: outline.length,
        duration: `${Date.now() - step1Start}ms`,
      });

      await this.checkCancellation();

      // Step 2: 解析功能模块列表
      const step2Start = Date.now();
      logger.info('TestCaseStepwiseGenerator: Step 2/7 - Parsing test modules', logContext);
      await this.checkCancellation();
      await this.setStepState('parse-modules', StepState.RUNNING);
      const modules = this.parseModules(outline);
      await this.setStepState('parse-modules', StepState.COMPLETED);
      logger.info('TestCaseStepwiseGenerator: Step 2/7 completed - Modules parsed', {
        ...logContext,
        moduleCount: modules.length,
        modules: modules.map((m) => `${m.number}. ${m.title}`),
        duration: `${Date.now() - step2Start}ms`,
      });

      await this.checkCancellation();

      // Step 3: 按功能模块生成测试用例
      const step3Start = Date.now();
      logger.info('TestCaseStepwiseGenerator: Step 3/7 - Generating test cases for each module', {
        ...logContext,
        moduleCount: modules.length,
      });
      await this.checkCancellation();
      await this.setStepState('generate-modules', StepState.RUNNING);
      const moduleContents = await this.generateModules(outline, modules);
      await this.setStepState('generate-modules', StepState.COMPLETED);
      logger.info('TestCaseStepwiseGenerator: Step 3/7 completed - All modules generated', {
        ...logContext,
        moduleCount: moduleContents.length,
        totalLength: moduleContents.reduce((sum, content) => sum + content.length, 0),
        duration: `${Date.now() - step3Start}ms`,
      });

      await this.checkCancellation();

      // Step 4: 评审各个功能模块的测试用例
      const step4Start = Date.now();
      logger.info('TestCaseStepwiseGenerator: Step 4/7 - Reviewing test cases for each module', logContext);
      await this.checkCancellation();
      await this.setStepState('review-modules', StepState.RUNNING);
      const moduleReviews = await this.reviewModules(moduleContents, modules, outline);
      await this.setStepState('review-modules', StepState.COMPLETED);
      logger.info('TestCaseStepwiseGenerator: Step 4/7 completed - Module reviews generated', {
        ...logContext,
        reviewCount: moduleReviews.length,
        duration: `${Date.now() - step4Start}ms`,
      });

      await this.checkCancellation();

      // Step 5: 改进各个功能模块的测试用例
      const step5Start = Date.now();
      logger.info('TestCaseStepwiseGenerator: Step 5/7 - Improving test cases for each module', logContext);
      await this.checkCancellation();
      await this.setStepState('improve-modules', StepState.RUNNING);
      const improvedModules = await this.improveModules(
        moduleContents,
        moduleReviews,
        modules,
        outline
      );
      await this.setStepState('improve-modules', StepState.COMPLETED);
      logger.info('TestCaseStepwiseGenerator: Step 5/7 completed - Modules improved', {
        ...logContext,
        improvedCount: improvedModules.length,
        duration: `${Date.now() - step5Start}ms`,
      });

      await this.checkCancellation();

      // Step 6: 合并所有功能模块的测试用例
      const step6Start = Date.now();
      logger.info('TestCaseStepwiseGenerator: Step 6/7 - Merging all modules', logContext);
      await this.checkCancellation();
      await this.setStepState('merge', StepState.RUNNING);
      const mergedContent = this.mergeModules(outline, improvedModules, modules);
      await this.saveToWorkspace(this.config.mainFileName, mergedContent);
      await this.setStepState('merge', StepState.COMPLETED);
      logger.info('TestCaseStepwiseGenerator: Step 6/7 completed - Modules merged', {
        ...logContext,
        totalLength: mergedContent.length,
        moduleCount: modules.length,
        duration: `${Date.now() - step6Start}ms`,
      });

      const totalDuration = Date.now() - startTime;
      logger.info('TestCaseStepwiseGenerator: Stepwise generation completed', {
        ...logContext,
        finalContentLength: mergedContent.length,
        moduleCount: modules.length,
        workspaceDir: this.config.workspaceDir,
        mainFileName: this.config.mainFileName,
        totalDuration: `${totalDuration}ms`,
      });

      // 从 workspace 读取主文件内容
      let allContent: string;
      try {
        allContent = await this.readMainFileFromWorkspace();
        if (!allContent || allContent.trim().length === 0) {
          logger.warn('TestCaseStepwiseGenerator: Workspace content is empty, using merged content', logContext);
          allContent = mergedContent;
        }
      } catch (error: any) {
        logger.warn('TestCaseStepwiseGenerator: Failed to read from workspace, using merged content', {
          ...logContext,
          error: error.message,
        });
        allContent = mergedContent;
      }

      return {
        content: allContent,
        data: {
          type: this.config.documentType.toLowerCase(),
          filename: this.config.mainFileName,
          timestamp: new Date().toISOString(),
          mode: 'new',
          stepwise: true,
          moduleCount: modules.length,
          workspaceDir: this.config.workspaceDir,
        },
      };
    } catch (error: any) {
      logger.error('TestCaseStepwiseGenerator: Stepwise generation failed', {
        ...logContext,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Step 1: 生成功能模块列表（目录）
   */
  private async generateOutline(): Promise<string> {
    const logContext = this.getLogContext();
    logger.info('TestCaseStepwiseGenerator: Step 1 - Generating outline', logContext);

    await this.checkCancellation();

    const outlinePrompt = this.config.buildOutlinePrompt(this.config.prd, this.config.code);
    const outline = await (this.action as any).aask(outlinePrompt, [this.config.systemPrompt]);

    await this.checkCancellation();

    logger.info('TestCaseStepwiseGenerator: Outline generated', {
      ...logContext,
      outlineLength: outline.length,
    });

    return outline;
  }

  /**
   * Step 2: 解析功能模块列表
   */
  private parseModules(outline: string): TestModule[] {
    const modules: TestModule[] = [];
    const lines = outline.split('\n');

    let currentModule: Partial<TestModule> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 匹配 ## 功能模块名称 格式
      const moduleMatch = line.match(/^##\s+(?:功能模块\d+：)?(.+)$/);
      if (moduleMatch) {
        // 如果之前有模块未完成，先保存它
        if (currentModule && currentModule.title) {
          modules.push({
            number: modules.length + 1,
            title: currentModule.title,
            description: currentModule.description,
          });
        }
        
        // 开始新模块
        currentModule = {
          title: moduleMatch[1].trim(),
        };
      } else if (currentModule && line.trim() && !line.trim().startsWith('#')) {
        // 如果当前行不是标题，且不是空行，则作为描述
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
          // 累积描述（可能有多行）
          if (currentModule.description) {
            currentModule.description += '\n' + trimmedLine;
          } else {
            currentModule.description = trimmedLine;
          }
        }
      }
    }

    // 保存最后一个模块
    if (currentModule && currentModule.title) {
      modules.push({
        number: modules.length + 1,
        title: currentModule.title,
        description: currentModule.description,
      });
    }

    if (modules.length === 0) {
      const logContext = this.getLogContext();
      logger.warn('TestCaseStepwiseGenerator: No modules parsed, using default modules', logContext);
      // 如果没有解析到模块，返回默认模块
      return [
        { number: 1, title: '核心功能模块', description: '系统的核心功能模块，包含主要业务逻辑' },
        { number: 2, title: '辅助功能模块', description: '系统的辅助功能模块，提供支持性功能' },
      ];
    }

    return modules;
  }

  /**
   * Step 3: 按功能模块生成测试用例
   */
  private async generateModules(
    outline: string,
    modules: TestModule[]
  ): Promise<string[]> {
    const moduleContents: string[] = [];
    const modulesStartTime = Date.now();
    const logContext = this.getLogContext();

    logger.info('TestCaseStepwiseGenerator: Starting module generation', {
      ...logContext,
      totalModules: modules.length,
      modules: modules.map((m) => `${m.number}. ${m.title}`),
    });

    for (let i = 0; i < modules.length; i++) {
      await this.checkCancellation();

      const module = modules[i];
      const moduleStartTime = Date.now();
      const stepId = `module-${module.number}`;

      logger.info(
        `TestCaseStepwiseGenerator: Generating module ${i + 1}/${modules.length} - ${module.number}. ${module.title}`,
        {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
          totalModules: modules.length,
          currentProgress: `${i + 1}/${modules.length}`,
        }
      );

      try {
        await this.setStepState(stepId, StepState.RUNNING);

        const modulePrompt = this.config.buildSectionPrompt(
          this.config.prd,
          this.config.code,
          outline,
          module.number,
          module.title,
          module.description
        );

        const moduleContent = await (this.action as any).aask(modulePrompt, [this.config.systemPrompt]);

        await this.checkCancellation();

        moduleContents.push(moduleContent);
        await this.setStepState(stepId, StepState.COMPLETED);

        // 保存每个模块到文件
        const moduleFileName = `${String(module.number).padStart(2, '0')}-module-${module.number}.md`;
        await this.saveToWorkspace(moduleFileName, moduleContent);

        await this.checkCancellation();

        const moduleDuration = Date.now() - moduleStartTime;
        logger.info(`TestCaseStepwiseGenerator: Module ${module.number} generated successfully`, {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
          contentLength: moduleContent.length,
          fileName: moduleFileName,
          duration: `${moduleDuration}ms`,
          progress: `${i + 1}/${modules.length}`,
        });

        await this.checkCancellation();
      } catch (error: any) {
        if (error.message?.includes('cancelled') || error.message?.includes('Operation cancelled')) {
          logger.info(`TestCaseStepwiseGenerator: Module generation cancelled at module ${module.number}`, {
            ...logContext,
            moduleNumber: module.number,
            moduleTitle: module.title,
          });
          throw error;
        }

        await this.setStepState(stepId, StepState.FAILED);
        const moduleDuration = Date.now() - moduleStartTime;
        logger.error(`TestCaseStepwiseGenerator: Failed to generate module ${module.number}`, {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
          error: error.message,
          stack: error.stack,
          duration: `${moduleDuration}ms`,
          progress: `${i + 1}/${modules.length}`,
        });
        const errorContent = `## 功能模块：${module.title}\n\n[生成失败: ${error.message}]`;
        moduleContents.push(errorContent);
      }
    }

    return moduleContents;
  }

  /**
   * Step 4: 评审各个功能模块的测试用例
   */
  private async reviewModules(
    moduleContents: string[],
    modules: TestModule[],
    outline: string
  ): Promise<string[]> {
    const moduleReviews: string[] = [];
    const logContext = this.getLogContext();

    logger.info('TestCaseStepwiseGenerator: Starting module reviews', {
      ...logContext,
      totalModules: modules.length,
    });

    for (let i = 0; i < modules.length; i++) {
      await this.checkCancellation();

      const module = modules[i];
      const moduleContent = moduleContents[i];
      const reviewStartTime = Date.now();
      const stepId = `review-module-${module.number}`;

      logger.info(
        `TestCaseStepwiseGenerator: Reviewing module ${i + 1}/${modules.length} - ${module.number}. ${module.title}`,
        {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
        }
      );

      try {
        await this.setStepState(stepId, StepState.RUNNING);

        const reviewPrompt = this.config.buildSectionReviewPrompt(
          moduleContent,
          module.number,
          module.title,
          outline,
          this.config.prd,
          this.config.code,
          module.description
        );

        const reviewContent = await (this.action as any).aask(reviewPrompt, [this.config.reviewSystemPrompt]);

        await this.checkCancellation();

        moduleReviews.push(reviewContent);
        await this.setStepState(stepId, StepState.COMPLETED);

        // 保存每个模块的评审报告
        const reviewFileName = `${String(module.number).padStart(2, '0')}-module-${module.number}-review.md`;
        await this.saveToWorkspace(reviewFileName, reviewContent);

        await this.checkCancellation();

        const reviewDuration = Date.now() - reviewStartTime;
        logger.info(`TestCaseStepwiseGenerator: Module ${module.number} reviewed successfully`, {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
          reviewLength: reviewContent.length,
          fileName: reviewFileName,
          duration: `${reviewDuration}ms`,
        });

        await this.checkCancellation();
      } catch (error: any) {
        if (error.message?.includes('cancelled') || error.message?.includes('Operation cancelled')) {
          logger.info(`TestCaseStepwiseGenerator: Module review cancelled at module ${module.number}`, {
            ...logContext,
            moduleNumber: module.number,
            moduleTitle: module.title,
          });
          throw error;
        }

        await this.setStepState(stepId, StepState.FAILED);
        logger.error(`TestCaseStepwiseGenerator: Failed to review module ${module.number}`, {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
          error: error.message,
        });
        moduleReviews.push(`[评审失败: ${error.message}]`);
      }
    }

    return moduleReviews;
  }

  /**
   * Step 5: 改进各个功能模块的测试用例
   */
  private async improveModules(
    moduleContents: string[],
    moduleReviews: string[],
    modules: TestModule[],
    outline: string
  ): Promise<string[]> {
    const improvedModules: string[] = [];
    const logContext = this.getLogContext();

    logger.info('TestCaseStepwiseGenerator: Starting module improvements', {
      ...logContext,
      totalModules: modules.length,
    });

    for (let i = 0; i < modules.length; i++) {
      await this.checkCancellation();

      const module = modules[i];
      const moduleContent = moduleContents[i];
      const reviewReport = moduleReviews[i];
      const improveStartTime = Date.now();
      const stepId = `improve-module-${module.number}`;

      logger.info(
        `TestCaseStepwiseGenerator: Improving module ${i + 1}/${modules.length} - ${module.number}. ${module.title}`,
        {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
        }
      );

      try {
        await this.setStepState(stepId, StepState.RUNNING);

        const improvePrompt = this.config.buildSectionImprovePrompt(
          moduleContent,
          reviewReport,
          module.number,
          module.title,
          outline,
          this.config.prd,
          this.config.code,
          module.description
        );

        const improvedContent = await (this.action as any).aask(improvePrompt, [
          this.config.improveSystemPrompt,
        ]);

        await this.checkCancellation();

        improvedModules.push(improvedContent);
        await this.setStepState(stepId, StepState.COMPLETED);

        // 保存改进后的模块
        const improvedFileName = `${String(module.number).padStart(2, '0')}-module-${module.number}-improved.md`;
        await this.saveToWorkspace(improvedFileName, improvedContent);

        await this.checkCancellation();

        const improveDuration = Date.now() - improveStartTime;
        logger.info(`TestCaseStepwiseGenerator: Module ${module.number} improved successfully`, {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
          improvedLength: improvedContent.length,
          fileName: improvedFileName,
          duration: `${improveDuration}ms`,
        });

        await this.checkCancellation();
      } catch (error: any) {
        if (error.message?.includes('cancelled') || error.message?.includes('Operation cancelled')) {
          logger.info(`TestCaseStepwiseGenerator: Module improvement cancelled at module ${module.number}`, {
            ...logContext,
            moduleNumber: module.number,
            moduleTitle: module.title,
          });
          throw error;
        }

        await this.setStepState(stepId, StepState.FAILED);
        logger.error(`TestCaseStepwiseGenerator: Failed to improve module ${module.number}`, {
          ...logContext,
          moduleNumber: module.number,
          moduleTitle: module.title,
          error: error.message,
        });
        // 如果改进失败，使用原始内容
        improvedModules.push(moduleContent);
      }
    }

    return improvedModules;
  }

  /**
   * Step 6: 合并所有功能模块的测试用例
   */
  private mergeModules(
    outline: string,
    moduleContents: string[],
    modules: TestModule[]
  ): string {
    const parts: string[] = [];

    // 添加标题
    parts.push('# 功能测试用例文档\n');

    // 添加功能模块列表
    parts.push('## 功能模块列表\n');
    modules.forEach((module) => {
      parts.push(`- ${module.number}. ${module.title}`);
      if (module.description) {
        parts.push(`  ${module.description}`);
      }
    });
    parts.push('\n---\n');

    // 添加每个功能模块的测试用例
    modules.forEach((module, index) => {
      const content = moduleContents[index];
      if (content && content.trim().length > 0) {
        parts.push(content);
        parts.push('\n\n---\n\n');
      }
    });

    return parts.join('\n');
  }

  /**
   * 保存文件到 workspace
   */
  private async saveToWorkspace(filename: string, content: string): Promise<void> {
    const filePath = path.join(this.config.workspaceDir, filename);
    await fs.mkdir(this.config.workspaceDir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 从 workspace 读取主文件
   */
  private async readMainFileFromWorkspace(): Promise<string> {
    const filePath = path.join(this.config.workspaceDir, this.config.mainFileName);
    return await fs.readFile(filePath, 'utf-8');
  }

  /**
   * 设置步骤状态 (用于日志记录)
   */
  private async setStepState(stepId: string, state: StepState): Promise<void> {
    logger.debug('TestCaseStepwiseGenerator: Step state changed', {
      role: this.config.role,
      stepId,
      state,
    });
  }

  /**
   * 检查是否已取消
   */
  private async checkCancellation(): Promise<void> {
    if (this.isCancelled) {
      throw new Error('Operation cancelled');
    }

    if (this.abortController?.signal.aborted) {
      this.isCancelled = true;
      throw new Error('Operation cancelled');
    }
  }

  /**
   * 取消生成
   */
  cancel(): void {
    this.isCancelled = true;
    this.abortController?.abort();
  }
}
