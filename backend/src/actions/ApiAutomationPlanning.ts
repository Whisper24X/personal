/**
 * ApiAutomationPlanning Action
 * Plans API/interface automation: reads TEST.md and generates api-test-*.js scripts to docs/test/auto-api
 * Uses apifox-skill conventions. Does not modify docs/test/auto (Playwright).
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, WorkspaceManager } from '../utils';
import { buildCLIModePrompt, CLI_IO_CONFIGS } from '../utils/document/CLIPromptBuilder';

export interface ApiAutomationPlanningOptions extends WorkspaceOptions {
  testUrl?: string;
  baseUrl?: string;
}

export class ApiAutomationPlanning extends BaseAction {
  constructor() {
    super('ApiAutomationPlanning', 'Plan API automation: generate api-test-*.js scripts from TEST.md to docs/test/auto-api (apifox-skill)');
  }

  async run(_input: string, options?: ApiAutomationPlanningOptions): Promise<IActionOutput> {
    if (!this.isCLIMode()) {
      logger.info('ApiAutomationPlanning: Not in CLI mode, skipping API script generation');
      return {
        content: '接口自动化规划需要 CLI 模式。请将执行模式切换为 CLI 后重试。',
        data: {
          type: 'api_automation_plan',
          timestamp: new Date().toISOString(),
          skipped: true,
          reason: 'Not in CLI mode',
        },
      };
    }

    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const workspaceDir = this.getWorkspaceDir(workspaceOptions);

    logger.info('ApiAutomationPlanning: Running in CLI mode', {
      workspaceDir,
      executorMode: this.getExecutorMode(),
    });

    try {
      const autoApiDir = path.join(workspaceDir, 'auto-api');
      await fs.mkdir(autoApiDir, { recursive: true });
      logger.debug('ApiAutomationPlanning: Ensured auto-api directory exists', { autoApiDir });

      const prompt = this.buildCLIPrompt(workspaceDir, options);
      const systemPrompt = await this.buildCLISystemPrompt();

      logger.info('ApiAutomationPlanning: Executing CLI tool', {
        promptLength: prompt.length,
        systemPromptLength: systemPrompt.length,
        workspaceDir,
      });

      const output = await this.execute(prompt, {
        workDir: workspaceDir,
        systemPrompt,
      });

      logger.info('ApiAutomationPlanning: CLI tool execution completed', { outputLength: output.length });

      const scriptFiles = await this.readGeneratedScriptFiles(workspaceDir);

      logger.info('ApiAutomationPlanning: CLI mode completed', {
        scriptFilesCount: scriptFiles.length,
        scriptFiles: scriptFiles.map((f) => f.filename),
      });

      const summary =
        scriptFiles.length > 0
          ? `已按 apifox-skill 约定生成 ${scriptFiles.length} 个接口自动化脚本到 docs/test/auto-api`
          : 'CLI 工具执行完成，但未在 docs/test/auto-api 中找到生成的 api-test-*.js 脚本';

      return {
        content: summary,
        data: {
          type: 'api_automation_plan',
          timestamp: new Date().toISOString(),
          workspaceDir,
          scriptFilesGenerated: scriptFiles.length > 0,
          scriptFilesCount: scriptFiles.length,
          scriptFiles: scriptFiles.map((f) => ({ id: f.id, filename: f.filename })),
          cliMode: true,
        },
      };
    } catch (error: any) {
      logger.error('ApiAutomationPlanning: CLI mode failed', {
        error: error.message,
        stack: error.stack,
        workspaceDir,
      });
      throw error;
    }
  }

  private async loadApifoxSkillForCLI(): Promise<string> {
    const projectRoot = WorkspaceManager.getProjectRootPath();
    const skillPath = path.join(projectRoot, 'skills', 'apifox-skill', 'SKILL.md');
    try {
      const skillContent = await fs.readFile(skillPath, 'utf-8');
      return skillContent.length > 4000 ? skillContent.slice(0, 4000) + '\n\n...' : skillContent;
    } catch (error) {
      logger.warn('ApiAutomationPlanning: Failed to load apifox-skill', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  private async buildCLISystemPrompt(): Promise<string> {
    const skillContent = await this.loadApifoxSkillForCLI();

    return `你是一个专业的接口自动化测试工程师。你的任务是根据测试用例文档中的**接口测试**用例，按 apifox-skill 的约定生成 **Node.js 接口测试脚本**，并保存到 **docs/test/auto-api** 目录。

## 输出要求

- 生成物：每个接口测试用例对应一个 **.js** 文件（api-test-*.js），不要生成 Playwright 或 JSON。
- 输出目录：**所有脚本必须写入 docs/test/auto-api**（相对当前 workspace 的 docs/test/auto-api），不要写入 docs/test/auto 或 /tmp。
- 仅生成接口/API 相关用例的脚本；从 When/Then 解析请求方法、URL、body、预期状态码与响应字段。
- 脚本顶部使用 \`const BASE_URL = process.env.BASE_URL || '...'\`、\`const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''\` 参数化。
- 使用 axios 或 Node 原生 http(s) 发请求，断言状态码与关键字段后 \`console.log('PASS')\` 或 \`process.exit(1)\`。

## apifox-skill 参考

${skillContent || '请按接口测试规范编写 Node.js 脚本，每个用例一个独立 api-test-*.js 文件。'}

## 文件命名

- 格式：\`api-test-TC-XXX-用例简述.js\`（例如 \`api-test-TC-CSV-001-CSV映射配置接口.js\`）。
- 从 TEST.md / TEST_REVIEW.md 解析接口相关用例的编号与名称，仅为接口测试用例生成脚本。`;
  }

  private async readGeneratedScriptFiles(workspaceDir: string): Promise<Array<{ id: string; filename: string }>> {
    const autoApiDir = path.join(workspaceDir, 'auto-api');
    const scriptFiles: Array<{ id: string; filename: string }> = [];

    try {
      await fs.access(autoApiDir);
    } catch {
      logger.warn('ApiAutomationPlanning: auto-api directory does not exist', { autoApiDir });
      return scriptFiles;
    }

    const entries = await fs.readdir(autoApiDir, { withFileTypes: true });
    const scriptEntries = entries.filter((entry) => entry.isFile() && entry.name.startsWith('api-test-') && entry.name.endsWith('.js'));

    for (const entry of scriptEntries) {
      const baseName = entry.name.replace(/\.js$/, '');
      const idMatch = baseName.match(/api-test-(TC-[\dA-Z-]+)/i) || [null, baseName];
      const id = idMatch[1] || baseName;
      scriptFiles.push({ id, filename: entry.name });
    }

    return scriptFiles.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  private buildCLIPrompt(workspaceDir: string, options?: ApiAutomationPlanningOptions): string {
    const config = CLI_IO_CONFIGS.write_api_automation_test;
    const baseWorkspaceDir = workspaceDir.replace(/\/docs\/test$/, '');
    const inputDir = config.inputDirRelative ? `${baseWorkspaceDir}/docs/${config.inputDirRelative}` : `${baseWorkspaceDir}/docs/test`;
    const outputDir = `${baseWorkspaceDir}/docs/${config.outputDirRelative}`;

    const taskPoints = [
      '从 docs/test 读取 TEST.md 或 TEST_REVIEW.md（优先 TEST_REVIEW.md）',
      '仅识别接口测试相关用例（步骤中含接口调用、验证响应状态码/返回字段等）',
      '按 apifox-skill 约定为每个接口用例生成一个 Node.js 脚本（api-test-*.js）',
      '脚本须自包含：BASE_URL/ACCESS_TOKEN 常量、axios 或 http 请求、状态码与响应断言',
      '文件命名：api-test-TC-XXX-用例简述.js',
      '**所有脚本必须保存到 docs/test/auto-api**，禁止写入 docs/test/auto 或其它路径',
    ];

    const systemContext = options?.baseUrl
      ? `BASE_URL 默认值建议: ${options.baseUrl}`
      : options?.testUrl
        ? `测试目标: ${options.testUrl}`
        : undefined;

    return buildCLIModePrompt({
      inputDir,
      outputDir,
      inputFileNames: config.inputFileNames,
      outputFileName: config.outputFileName,
      taskDescription: '根据测试用例文档中的接口测试用例，按 apifox-skill 约定生成接口自动化脚本到 docs/test/auto-api',
      taskPoints,
      systemContext,
      includeKnowledgeInput: true,
    });
  }
}
