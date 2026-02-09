/**
 * Version Review Service
 * 版本审查服务
 *
 * 通过5轮交互式提问帮助用户检查版本想法与系统核心逻辑的一致性
 * 支持前端 API 交互模式，使用状态机管理审查流程
 */

import { WorkspaceManager } from '../utils/WorkspaceManager';
import { CLIExecutor } from '../executors/CLIExecutor';
import { CLIProviderType, CLIProviderConfig } from '../executors/types';
import { CLIConfigUtil } from '../utils/cliConfigUtil';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { ProjectVersionRepository } from '../database/repositories/ProjectVersionRepository';
import { logger } from '../utils';
import * as path from 'path';
import { QuestionType, QUESTION_TYPE_LABELS } from '../prompts/versionReview';

export type ReviewStatus = 'pending' | 'generating_question' | 'waiting_answer' | 'generating_document' | 'completed' | 'failed';

export interface VersionReviewOptions {
  projectId: string;
  versionId: string;
  versionName: string;
  userIdea: string;
  applicationId: string;
}

export interface QuestionAnswer {
  question: string;
  answer: string;
  questionType: QuestionType;
}

export interface VersionReviewState {
  reviewStatus: ReviewStatus;
  currentRound: number; // 当前轮次 (1-5)
  questionsAndAnswers: QuestionAnswer[];
  reviewDocumentPath?: string;
  error?: string;
}

export interface VersionReviewResult {
  completed: boolean;
  questionsAndAnswers: QuestionAnswer[];
  reviewDocumentPath?: string;
  error?: string;
}

const QUESTION_TYPES = [
  QuestionType.BUSINESS_RULES,
  QuestionType.FEATURE_CONFLICT,
  QuestionType.TERMINOLOGY,
  QuestionType.DATA_MODEL,
  QuestionType.FINAL_CONFIRMATION,
];

const TOTAL_ROUNDS = QUESTION_TYPES.length;

/**
 * 版本审查服务
 * 支持前端 API 交互模式，使用状态机管理审查流程
 */
export class VersionReviewService {
  private cliExecutor?: CLIExecutor;
  private workspacePath?: string;
  private versionRepo: ProjectVersionRepository;

  constructor() {
    this.versionRepo = new ProjectVersionRepository();
  }

  /**
   * 获取审查状态
   */
  async getReviewStatus(versionId: string): Promise<VersionReviewState | null> {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      return null;
    }

    const reviewState = version.metadata?.versionReview as VersionReviewState | undefined;
    if (!reviewState) {
      return {
        reviewStatus: 'pending',
        currentRound: 0,
        questionsAndAnswers: [],
      };
    }

    return reviewState;
  }

  /**
   * 更新审查状态
   */
  private async updateReviewStatus(versionId: string, state: Partial<VersionReviewState>): Promise<void> {
    const currentState = await this.getReviewStatus(versionId);
    const updatedState: VersionReviewState = {
      ...currentState!,
      ...state,
    };

    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const metadata = {
      ...version.metadata,
      versionReview: updatedState,
    };

    await this.versionRepo.update(versionId, { metadata });
  }

  /**
   * 启动版本审查流程
   * 初始化审查状态并生成第一轮问题
   */
  async startReview(options: VersionReviewOptions): Promise<void> {
    const { projectId, versionId, versionName, userIdea, applicationId } = options;

    logger.info('VersionReviewService: Starting version review', {
      projectId,
      versionId,
      versionName,
    });

    try {
      // 检查是否已经启动
      const currentState = await this.getReviewStatus(versionId);
      if (currentState && currentState.reviewStatus !== 'pending' && currentState.reviewStatus !== 'failed') {
        logger.info('VersionReviewService: Review already started', {
          versionId,
          status: currentState.reviewStatus,
        });
        return;
      }

      // 初始化状态
      await this.updateReviewStatus(versionId, {
        reviewStatus: 'generating_question',
        currentRound: 1,
        questionsAndAnswers: [],
      });

      // 获取工作空间路径
      this.workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId,
        projectId,
        versionId,
      });

      // 初始化CLI执行器
      const cliConfig = await this.getCLIConfig(projectId);
      this.cliExecutor = new CLIExecutor({
        providerType: cliConfig.provider,
        providerConfig: cliConfig.config,
        defaultWorkDir: this.workspacePath,
      });

      // 生成第一轮问题
      await this.generateNextQuestion(versionId, projectId, userIdea, applicationId);
    } catch (error: any) {
      logger.error('VersionReviewService: Failed to start review', {
        projectId,
        versionId,
        error: error.message,
        stack: error.stack,
      });

      await this.updateReviewStatus(versionId, {
        reviewStatus: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 生成下一轮问题
   */
  async generateNextQuestion(versionId: string, projectId: string, userIdea: string, applicationId: string): Promise<void> {
    try {
      const state = await this.getReviewStatus(versionId);
      if (!state) {
        throw new Error('Review state not found');
      }

      const currentRound = state.currentRound;
      if (currentRound > TOTAL_ROUNDS) {
        // 所有问题已完成，生成文档
        await this.generateReviewDocument(versionId, projectId, userIdea, applicationId);
        return;
      }

      // 更新状态为正在生成问题
      await this.updateReviewStatus(versionId, {
        reviewStatus: 'generating_question',
      });

      // 确保 CLI 执行器已初始化
      if (!this.cliExecutor || !this.workspacePath) {
        this.workspacePath = WorkspaceManager.getProjectWorkspacePath({
          applicationId,
          projectId,
          versionId,
        });

        const cliConfig = await this.getCLIConfig(projectId);
        this.cliExecutor = new CLIExecutor({
          providerType: cliConfig.provider,
          providerConfig: cliConfig.config,
          defaultWorkDir: this.workspacePath,
        });
      }

      // 生成问题
      const questionType = QUESTION_TYPES[currentRound - 1];
      const question = await this.generateQuestionViaCLI(
        questionType,
        userIdea,
        state.questionsAndAnswers.map((qa) => ({
          question: qa.question,
          answer: qa.answer,
          questionType: qa.questionType,
        }))
      );

      // 添加问题到状态（答案为空）
      const updatedQAs = [...state.questionsAndAnswers];
      updatedQAs.push({
        question,
        answer: '',
        questionType,
      });

      // 更新状态为等待答案
      await this.updateReviewStatus(versionId, {
        reviewStatus: 'waiting_answer',
        questionsAndAnswers: updatedQAs,
      });

      logger.info('VersionReviewService: Question generated', {
        versionId,
        round: currentRound,
        questionType,
      });
    } catch (error: any) {
      logger.error('VersionReviewService: Failed to generate question', {
        versionId,
        error: error.message,
      });

      await this.updateReviewStatus(versionId, {
        reviewStatus: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 提交用户答案并继续下一轮
   */
  async submitAnswer(versionId: string, answer: string, projectId: string, userIdea: string, applicationId: string): Promise<void> {
    try {
      const state = await this.getReviewStatus(versionId);
      if (!state) {
        throw new Error('Review state not found');
      }

      if (state.reviewStatus !== 'waiting_answer') {
        throw new Error(`Invalid status for submitting answer: ${state.reviewStatus}`);
      }

      // 更新当前问题的答案
      const updatedQAs = [...state.questionsAndAnswers];
      const currentIndex = updatedQAs.length - 1;
      if (currentIndex >= 0) {
        updatedQAs[currentIndex] = {
          ...updatedQAs[currentIndex],
          answer: answer.trim(),
        };
      }

      // 更新状态
      const nextRound = state.currentRound + 1;
      await this.updateReviewStatus(versionId, {
        currentRound: nextRound,
        questionsAndAnswers: updatedQAs,
      });

      logger.info('VersionReviewService: Answer submitted', {
        versionId,
        round: state.currentRound,
        answerLength: answer.length,
      });

      // 如果还有下一轮，生成下一轮问题
      if (nextRound <= TOTAL_ROUNDS) {
        await this.generateNextQuestion(versionId, projectId, userIdea, applicationId);
      } else {
        // 所有问题已完成，生成文档
        await this.generateReviewDocument(versionId, projectId, userIdea, applicationId);
      }
    } catch (error: any) {
      logger.error('VersionReviewService: Failed to submit answer', {
        versionId,
        error: error.message,
      });

      await this.updateReviewStatus(versionId, {
        reviewStatus: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 生成审查文档
   */
  private async generateReviewDocument(versionId: string, projectId: string, userIdea: string, applicationId: string): Promise<void> {
    try {
      const state = await this.getReviewStatus(versionId);
      if (!state) {
        throw new Error('Review state not found');
      }

      // 更新状态为正在生成文档
      await this.updateReviewStatus(versionId, {
        reviewStatus: 'generating_document',
      });

      // 确保 CLI 执行器已初始化
      if (!this.cliExecutor || !this.workspacePath) {
        this.workspacePath = WorkspaceManager.getProjectWorkspacePath({
          applicationId,
          projectId,
          versionId,
        });

        const cliConfig = await this.getCLIConfig(projectId);
        this.cliExecutor = new CLIExecutor({
          providerType: cliConfig.provider,
          providerConfig: cliConfig.config,
          defaultWorkDir: this.workspacePath,
        });
      }

      // 获取版本信息
      const version = await this.versionRepo.findById(versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      // 生成文档
      const reviewDocumentPath = await this.generateReviewDocumentViaCLI(version.version_name, userIdea, state.questionsAndAnswers);

      // 更新状态为已完成
      await this.updateReviewStatus(versionId, {
        reviewStatus: 'completed',
        reviewDocumentPath,
      });

      logger.info('VersionReviewService: Review document generated', {
        versionId,
        documentPath: reviewDocumentPath,
      });
    } catch (error: any) {
      logger.error('VersionReviewService: Failed to generate review document', {
        versionId,
        error: error.message,
      });

      await this.updateReviewStatus(versionId, {
        reviewStatus: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 获取CLI配置
   * 优先级：项目绑定的API key > 环境变量 > 默认配置
   */
  private async getCLIConfig(projectId: string): Promise<{ provider: CLIProviderType; config?: Partial<CLIProviderConfig> }> {
    // 优先级1: 检查项目绑定的API key
    try {
      const projectRepo = new ProjectRepository();
      const platformApiKey = await projectRepo.getCliApiKey(projectId);

      if (platformApiKey) {
        const globalConfig = CLIConfigUtil.loadGlobalConfig();
        const cliProvider = (process.env.DEFAULT_CLI_PROVIDER as CLIProviderType) || 'cursor';
        const cliConfig = CLIConfigUtil.toCLIProviderConfig(globalConfig, cliProvider);

        // 移除type字段（已在providerType中指定）
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, ...configWithoutType } = cliConfig;

        return {
          provider: cliProvider,
          config: {
            ...configWithoutType,
            apiKey: platformApiKey, // 使用项目API key
          },
        };
      }
    } catch (error: any) {
      logger.warn('VersionReviewService: Failed to get project CLI API key', {
        projectId,
        error: error.message,
      });
    }

    // 优先级2: 从环境变量加载全局配置
    const globalConfig = CLIConfigUtil.loadGlobalConfig();
    const cliProvider = (process.env.DEFAULT_CLI_PROVIDER as CLIProviderType) || 'cursor';
    const cliConfig = CLIConfigUtil.toCLIProviderConfig(globalConfig, cliProvider);

    // 移除type字段（已在providerType中指定）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type, ...configWithoutType } = cliConfig;

    return {
      provider: cliProvider,
      config: configWithoutType,
    };
  }

  /**
   * 通过CLI工具生成问题（使用skill指导）
   */
  private async generateQuestionViaCLI(
    questionType: QuestionType,
    userIdea: string,
    previousAnswers: Array<{ question: string; answer: string; questionType: QuestionType }>
  ): Promise<string> {
    if (!this.cliExecutor || !this.workspacePath) {
      throw new Error('CLI executor or workspace path not initialized');
    }

    // 构建之前的问答上下文
    const previousContext =
      previousAnswers.length > 0
        ? `\n【之前的问答记录】\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
        : '';

    // 构建简洁的prompt，让CLI读取skill文件并执行
    const prompt = `请阅读并严格执行技能 version-review 中定义的版本审查流程。

当前需要生成第 ${QUESTION_TYPE_LABELS[questionType]} 轮的问题。

【版本想法】
${userIdea}
${previousContext}

请按照skill文件中对应轮次的指导，生成一个具体、可操作的问题。
问题应该关注冲突和一致性问题，并提供明确的修改建议。

请直接输出问题内容，不要包含其他说明。`;

    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 通过CLI工具执行，CLI会自动读取skill文件
        const question = await this.cliExecutor.execute(prompt, {
          workDir: this.workspacePath,
          // 不再传递systemPrompt，让CLI自己处理skill文件
        });

        const trimmedQuestion = question.trim();

        // 验证问题是否为空
        if (!trimmedQuestion || trimmedQuestion.length === 0) {
          if (attempt < maxRetries) {
            logger.warn('VersionReviewService: Generated question is empty, retrying', {
              questionType,
              attempt: attempt + 1,
              maxRetries: maxRetries + 1,
              originalOutput: question.substring(0, 100),
            });
            // 继续重试
            continue;
          } else {
            // 所有重试都失败
            throw new Error(
              `Failed to generate valid question after ${maxRetries + 1} attempts. Question type: ${QUESTION_TYPE_LABELS[questionType]}`
            );
          }
        }

        // 问题有效，返回
        logger.info('VersionReviewService: Question generated successfully', {
          questionType,
          attempt: attempt + 1,
          questionLength: trimmedQuestion.length,
        });

        return trimmedQuestion;
      } catch (error: any) {
        if (attempt < maxRetries) {
          logger.warn('VersionReviewService: Failed to generate question, retrying', {
            questionType,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            error: error.message,
          });
          // 继续重试
          continue;
        } else {
          // 所有重试都失败，抛出错误
          logger.error('VersionReviewService: Failed to generate question after all retries', {
            questionType,
            attempts: maxRetries + 1,
            error: error.message,
          });
          throw new Error(`Failed to generate question for ${QUESTION_TYPE_LABELS[questionType]} after ${maxRetries + 1} attempts: ${error.message}`);
        }
      }
    }

    // 理论上不会到达这里，但为了类型安全
    throw new Error(`Failed to generate question for ${QUESTION_TYPE_LABELS[questionType]}`);
  }

  /**
   * 通过CLI工具生成审查文档
   */
  private async generateReviewDocumentViaCLI(versionName: string, userIdea: string, questionsAndAnswers: QuestionAnswer[]): Promise<string> {
    if (!this.cliExecutor || !this.workspacePath) {
      throw new Error('CLI executor or workspace path not initialized');
    }

    // 保存文档路径
    const safeVersionName = versionName.replace(/[<>:"/\\|?*]/g, '_');
    const documentPath = path.join(this.workspacePath, 'docs', 'version-review', `${safeVersionName}-review.md`);

    // 构建问答记录
    const qaSection = questionsAndAnswers
      .map((qa, i) => {
        const questionTypeLabel = qa.questionType ? QUESTION_TYPE_LABELS[qa.questionType] : `第${i + 1}轮审查`;
        return `### 第${i + 1}轮：${questionTypeLabel}\n\n**问题：**\n${qa.question}\n\n**回答：**\n${qa.answer || '（未回答）'}\n`;
      })
      .join('\n');

    // 构建简洁的prompt，让CLI读取skill文件并执行
    const prompt = `请阅读并严格执行技能 version-review 中定义的版本审查文档生成流程。

【版本信息】
- 版本名称：${versionName}
- 版本想法：${userIdea}
- 生成时间：${new Date().toLocaleString('zh-CN')}

【问答记录】
${qaSection}

请按照skill文件中的"Review Document Generation"部分的指导，生成完整的版本审查文档。

请将文档保存到：${documentPath}`;

    try {
      // 通过CLI工具执行，CLI会自动读取skill文件
      await this.cliExecutor.execute(prompt, {
        workDir: this.workspacePath,
        outputFile: documentPath,
        // 不再传递systemPrompt，让CLI自己处理skill文件
      });

      logger.info('VersionReviewService: Review document generated via CLI', {
        documentPath,
      });

      return documentPath;
    } catch (error: any) {
      logger.error('VersionReviewService: Failed to generate review document via CLI', {
        error: error.message,
      });
      throw error;
    }
  }
}
