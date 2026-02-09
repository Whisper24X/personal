/**
 * AutomationPlanning Action
 * Evaluates which test cases can be automated and creates an automation plan
 * Generates JSON format test case files for automation execution
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, WorkspaceManager } from '../utils';
import { buildCLIModePrompt } from '../utils/document/CLIPromptBuilder';

export interface AutomationPlanningOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
  testUrl?: string; // Optional URL to test against
  /** Enable MCP validation after JSON generation (default: false) */
  enableMCPValidation?: boolean;
  /** Enable MCP auto-fix for detected issues (default: false) */
  enableMCPAutoFix?: boolean;
  /** Maximum number of fix attempts per JSON file (default: 1) */
  mcpMaxFixAttempts?: number;
}

export class AutomationPlanning extends BaseAction {
  constructor() {
    super(
      'AutomationPlanning',
      'Evaluate test cases for automation feasibility and create an automation plan with priorities and technology choices'
    );
  }

  async run(input: string, options?: AutomationPlanningOptions): Promise<IActionOutput> {
    const isCLIMode = this.isCLIMode();

    logger.info('========================================');
    logger.info('AutomationPlanning: Starting automation planning', {
      isCLIMode,
      executorMode: this.getExecutorMode(),
    });
    logger.info('========================================');

    if (isCLIMode) {
      // CLI 模式：使用 Cursor CLI 按 playwright-skill 约定生成 Playwright 脚本到 docs/test/auto
      return await this.runCLIMode(input, options);
    } else {
      // LLM 模式：保持现有的文本解析逻辑
      return await this.runLLMMode(input, options);
    }
  }

  /**
   * LLM 模式：使用文本解析逻辑生成 JSON 文件
   */
  private async runLLMMode(input: string, options?: AutomationPlanningOptions): Promise<IActionOutput> {
    try {
      // Read test cases from workspace
      let testCases = '';

      if (options) {
        // Try to read reviewed test cases first, fallback to original test cases
        try {
          const reviewedTestCases = await this.readWorkspaceFile('TEST_REVIEW.md', {
            ...options,
            documentType: 'TEST',
          });
          if (reviewedTestCases) {
            testCases = reviewedTestCases;
            logger.info('AutomationPlanning: Loaded reviewed test cases from workspace', {
              testCasesLength: testCases.length,
            });
          }
        } catch (error: any) {
          logger.warn('AutomationPlanning: Failed to read reviewed test cases, trying original', {
            error: error.message,
          });
        }

        // Fallback to original test cases
        if (!testCases) {
          try {
            const originalTestCases = await this.readWorkspaceFile('TEST.md', {
              ...options,
              documentType: 'TEST',
            });
            if (originalTestCases) {
              testCases = originalTestCases;
            }
          } catch (error: any) {
            logger.warn('AutomationPlanning: Failed to read test cases from workspace', {
              error: error.message,
            });
          }
        }
      }

      // Use input if test cases not found in workspace
      if (!testCases) {
        testCases = input;
      }

      if (!testCases || testCases.trim() === '') {
        throw new Error('Test cases not found for automation planning');
      }

      // Generate JSON files from test cases (no browser validation)
      let validationResults = '';
      let jsonScriptFiles: Array<{ id: string; filename: string; content: string }> = [];
      const sampleTestCases = this.extractSampleTestCases(testCases, 50);
      const testUrl = options?.testUrl || this.extractUrlFromTestCases(testCases);
      const passedCases = sampleTestCases.filter((tc) => tc.steps && tc.steps.length > 0);

      if (passedCases.length > 0) {
        logger.info('AutomationPlanning: Generating JSON files from test cases', {
          sampleCount: sampleTestCases.length,
          withStepsCount: passedCases.length,
          testUrl,
        });
        jsonScriptFiles = await this.generateStagehandScripts(passedCases, testUrl, options);
        validationResults = '## 自动化用例生成\n\n已为提取的用例生成 JSON 文件。';
        logger.info('AutomationPlanning: JSON generation completed', {
          jsonFilesCount: jsonScriptFiles.length,
          testCaseIds: jsonScriptFiles.map((s) => s.id),
        });
      } else {
        logger.warn('AutomationPlanning: No test cases with steps extracted, skipping JSON generation', {
          sampleCount: sampleTestCases.length,
        });
      }

      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };

      // Ensure docs/test/auto exists so AutomationExecution can run even when 0 JSON files
      try {
        const docsTestDir = this.getWorkspaceDir(workspaceOptions);
        const autoDir = path.join(docsTestDir, 'auto');
        await fs.mkdir(autoDir, { recursive: true });
        logger.debug('AutomationPlanning: Ensured auto directory exists', { autoDir });
      } catch (mkdirError: any) {
        logger.warn('AutomationPlanning: Failed to ensure auto directory', { error: mkdirError.message });
      }

      // Save JSON files if generated (one file per test case)
      logger.info('AutomationPlanning: Checking if JSON files need to be saved', {
        jsonFilesCount: jsonScriptFiles.length,
        isArray: Array.isArray(jsonScriptFiles),
      });
      if (jsonScriptFiles && jsonScriptFiles.length > 0) {
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const expectedAutoDir = path.join(workspaceDir, 'auto');
        logger.info('AutomationPlanning: Starting to save JSON files', {
          jsonFilesCount: jsonScriptFiles.length,
          workspaceDir,
          expectedAutoDir,
          documentType: workspaceOptions.documentType,
        });
        try {
          const savedFiles: string[] = [];
          for (const scriptFile of jsonScriptFiles) {
            const scriptPath = `auto/${scriptFile.filename}`;
            const expectedFullPath = path.join(workspaceDir, scriptPath);
            try {
              logger.info('AutomationPlanning: Saving JSON file', {
                filename: scriptFile.filename,
                relativePath: scriptPath,
                expectedFullPath,
                workspaceDir,
                contentLength: scriptFile.content.length,
              });
              await this.saveToWorkspace(scriptPath, scriptFile.content, workspaceOptions);
              savedFiles.push(scriptPath);
              logger.info('AutomationPlanning: JSON file saved successfully', {
                filename: scriptFile.filename,
                relativePath: scriptPath,
                expectedFullPath,
              });
            } catch (fileError: any) {
              logger.error('AutomationPlanning: Failed to save individual JSON file', {
                filename: scriptFile.filename,
                relativePath: scriptPath,
                expectedFullPath,
                error: fileError.message,
                stack: fileError.stack,
              });
              // Continue saving other files even if one fails
            }
          }
          if (savedFiles.length > 0) {
            logger.info('AutomationPlanning: Saved JSON files successfully', {
              jsonFilesCount: jsonScriptFiles.length,
              savedCount: savedFiles.length,
              jsonFiles: savedFiles,
              workspaceDir,
              autoDir: expectedAutoDir,
              fullPath: `${workspaceDir}/auto/`,
            });
          } else {
            logger.warn('AutomationPlanning: No JSON files were saved successfully', {
              attemptedCount: jsonScriptFiles.length,
              workspaceDir,
              expectedAutoDir,
            });
          }
        } catch (saveError: any) {
          logger.error('AutomationPlanning: Failed to save JSON files, but continuing', {
            error: saveError.message,
            stack: saveError.stack,
            workspaceDir,
            expectedAutoDir,
          });
          // Don't throw - allow the process to continue
        }
      } else {
        logger.warn('AutomationPlanning: No JSON files to save', {
          jsonFilesCount: jsonScriptFiles?.length || 0,
          isArray: Array.isArray(jsonScriptFiles),
          reason: !jsonScriptFiles ? 'jsonScriptFiles is null/undefined' : jsonScriptFiles.length === 0 ? 'jsonScriptFiles.length is 0' : 'unknown',
        });
      }

      logger.info('AutomationPlanning: Preparing final summary', {
        jsonFilesCount: jsonScriptFiles.length,
        hasValidationResults: !!validationResults,
      });

      const summary =
        jsonScriptFiles.length > 0 ? `已筛选并生成 ${jsonScriptFiles.length} 个 JSON 格式测试用例文件` : validationResults || '未生成 JSON 文件';

      logger.info('AutomationPlanning: Automation planning completed', {
        summary,
        jsonFilesCount: jsonScriptFiles.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: summary,
        data: {
          type: 'automation_plan',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          jsonFilesGenerated: jsonScriptFiles.length > 0,
          jsonFilesCount: jsonScriptFiles.length,
        },
      };
    } catch (error: any) {
      logger.error('========================================');
      logger.error('AutomationPlanning: Failed to create automation plan', {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      logger.error('========================================');

      throw error;
    }
  }

  /**
   * CLI 模式：使用 CLI 工具生成 JSON 文件
   */
  private async runCLIMode(_input: string, options?: AutomationPlanningOptions): Promise<IActionOutput> {
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const workspaceDir = this.getWorkspaceDir(workspaceOptions);

    logger.info('AutomationPlanning: Running in CLI mode', {
      workspaceDir,
      executorMode: this.getExecutorMode(),
    });

    try {
      // 确保 auto 目录存在（docs/test/auto）
      const autoDir = path.join(workspaceDir, 'auto');
      await fs.mkdir(autoDir, { recursive: true });
      logger.debug('AutomationPlanning: Ensured auto directory exists', { autoDir });

      const prompt = this.buildCLIPrompt(workspaceDir, options);
      const systemPrompt = await this.buildCLISystemPrompt();

      logger.info('AutomationPlanning: Executing CLI tool', {
        promptLength: prompt.length,
        systemPromptLength: systemPrompt.length,
        workspaceDir,
      });

      const output = await this.execute(prompt, {
        workDir: workspaceDir,
        systemPrompt,
      });

      logger.info('AutomationPlanning: CLI tool execution completed', { outputLength: output.length });

      const scriptFiles = await this.readGeneratedScriptFiles(workspaceDir);

      logger.info('AutomationPlanning: CLI mode completed', {
        scriptFilesCount: scriptFiles.length,
        scriptFiles: scriptFiles.map((f) => f.filename),
      });

      const summary =
        scriptFiles.length > 0
          ? `已通过 Cursor CLI 按 playwright-skill 约定生成 ${scriptFiles.length} 个 Playwright 脚本到 docs/test/auto`
          : 'CLI 工具执行完成，但未在 docs/test/auto 中找到生成的 .js 脚本';

      return {
        content: summary,
        data: {
          type: 'automation_plan',
          timestamp: new Date().toISOString(),
          workspaceDir,
          scriptFilesGenerated: scriptFiles.length > 0,
          scriptFilesCount: scriptFiles.length,
          scriptFiles: scriptFiles.map((f) => ({ id: f.id, filename: f.filename })),
          jsonFilesGenerated: scriptFiles.length > 0,
          jsonFilesCount: scriptFiles.length,
          jsonFiles: scriptFiles.map((f) => ({ id: f.id, filename: f.filename })),
          cliMode: true,
        },
      };
    } catch (error: any) {
      logger.error('AutomationPlanning: CLI mode failed', {
        error: error.message,
        stack: error.stack,
        workspaceDir,
      });

      throw error;
    }
  }

  /**
   * 加载 playwright-skill 内容用于 CLI 模式（生成 Playwright 脚本）
   */
  private async loadPlaywrightSkillForCLI(): Promise<string> {
    const projectRoot = WorkspaceManager.getProjectRootPath();
    const skillPath = path.join(projectRoot, 'skills', 'playwright-skill', 'skills', 'playwright-skill', 'SKILL.md');

    try {
      const skillContent = await fs.readFile(skillPath, 'utf-8');
      // 限制总长度，避免 prompt 过长；保留 CRITICAL WORKFLOW、Execution Pattern、Common Patterns 等
      return skillContent.length > 4000 ? skillContent.slice(0, 4000) + '\n\n...' : skillContent;
    } catch (error) {
      logger.warn('AutomationPlanning: Failed to load playwright-skill', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  /**
   * 构建 CLI 模式的系统提示词（Playwright 脚本生成）
   */
  private async buildCLISystemPrompt(): Promise<string> {
    const skillContent = await this.loadPlaywrightSkillForCLI();

    return `你是一个专业的自动化测试工程师。你的任务是根据测试用例文档，按 playwright-skill 的约定生成 **Playwright JavaScript 脚本**，并保存到 **docs/test/auto** 目录。

## 输出要求

- 生成物：每个测试用例对应一个 **.js** 文件（Playwright 脚本），不要生成 JSON。
- 输出目录：**所有脚本必须写入 docs/test/auto**（相对当前 workspace 的 docs/test/auto），不要写入 /tmp 或其它目录。
- 遵循 playwright-skill 约定：
  - 使用 \`const { chromium } = require('playwright')\`，脚本内使用 \`(async () => { ... })()\` 等自执行异步函数。
  - URL 使用顶部常量（如 \`const TARGET_URL = '...'\`）参数化，便于配置。
  - 默认 \`headless: false\`，除非用户明确要求无头模式。
  - 每个脚本自包含：打开页面、执行步骤、断言、关闭浏览器。

## playwright-skill 参考

${skillContent || '请按 Playwright 官方写法编写浏览器自动化脚本，每个用例一个独立 .js 文件。'}

## 文件命名

- 格式：\`playwright-test-TC-XXX-用例简述.js\`（例如 \`playwright-test-TC-001-用户登录-正确账号密码登录成功.js\`）。
- 从 TEST.md / TEST_REVIEW.md 解析每个用例的编号与名称，为每个用例生成一个脚本文件。`;
  }

  /**
   * 读取 CLI 生成的 Playwright 脚本文件（.js / .ts）
   */
  private async readGeneratedScriptFiles(workspaceDir: string): Promise<Array<{ id: string; filename: string }>> {
    const autoDir = path.join(workspaceDir, 'auto');
    const scriptFiles: Array<{ id: string; filename: string }> = [];

    try {
      logger.info('AutomationPlanning: Reading generated script files', { autoDir });

      try {
        await fs.access(autoDir);
      } catch {
        logger.warn('AutomationPlanning: Auto directory does not exist', { autoDir });
        return scriptFiles;
      }

      const entries = await fs.readdir(autoDir, { withFileTypes: true });
      const scriptEntries = entries.filter((entry) => entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts')));

      logger.info('AutomationPlanning: Found script files', {
        totalFiles: entries.length,
        scriptCount: scriptEntries.length,
        scriptNames: scriptEntries.map((e) => e.name),
      });

      for (const entry of scriptEntries) {
        const baseName = entry.name.replace(/\.(js|ts)$/, '');
        // 从 playwright-test-TC-001-xxx 或 TC-001-xxx 提取 id
        const idMatch = baseName.match(/^(?:playwright-test-)?(TC-[\dA-Z-]+)/i) || [null, baseName];
        const id = idMatch[1] || baseName;

        scriptFiles.push({
          id,
          filename: entry.name,
        });
      }

      return scriptFiles.sort((a, b) => a.filename.localeCompare(b.filename));
    } catch (error: any) {
      logger.error('AutomationPlanning: Failed to read generated script files', {
        error: error.message,
        stack: error.stack,
        autoDir,
      });
      return scriptFiles;
    }
  }

  /**
   * 构建 CLI 模式的 Prompt（Playwright 脚本生成到 docs/test/auto）
   */
  private buildCLIPrompt(workspaceDir: string, options?: AutomationPlanningOptions): string {
    const baseWorkspaceDir = workspaceDir.replace(/\/docs\/test$/, '');
    const inputDir = `${baseWorkspaceDir}/docs/test`;
    const outputDir = `${baseWorkspaceDir}/docs/test/auto`;

    const testUrl = options?.testUrl || '';

    const taskPoints = [
      '从输入文件夹 docs/test 读取 TEST.md 或 TEST_REVIEW.md（优先 TEST_REVIEW.md）',
      '解析测试用例，提取每个用例的编号、名称、前置条件、测试步骤、预期结果',
      '按 playwright-skill 约定为每个测试用例生成一个 Playwright JavaScript 脚本（.js）',
      '脚本须自包含：require("playwright")、TARGET_URL 常量、headless: false、步骤与断言、browser.close()',
      '文件命名：playwright-test-TC-XXX-用例简述.js（例如 playwright-test-TC-001-用户登录-正确账号密码登录成功.js）',
      '**所有脚本必须保存到输出目录 docs/test/auto**，不要写入 /tmp 或其它路径',
    ];

    return buildCLIModePrompt({
      inputDir,
      outputDir,
      inputFileNames: ['TEST.md', 'TEST_REVIEW.md'],
      outputFileName: 'playwright-test-*.js',
      taskDescription: '使用 playwright-skill 约定，根据测试用例文档生成 Playwright 自动化测试脚本到 docs/test/auto',
      taskPoints,
      systemContext: testUrl ? `测试目标 URL: ${testUrl}` : undefined,
      includeKnowledgeInput: true,
    });
  }

  /**
   * Extract sample test cases for JSON generation
   * Now extracts ALL test cases, not just a sample
   */
  private extractSampleTestCases(
    testCases: string,
    maxCount?: number
  ): Array<{ id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string }> {
    const samples: Array<{ id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string }> = [];

    // Preprocess: avoid code block extraction when content is already a full document (starts with #)
    // so we don't truncate at the first inner ``` and lose the test case section
    let processedContent = testCases;
    let usedCodeBlock = false;
    const trimmedInput = testCases.trim();
    if (!trimmedInput.match(/^#+\s/m)) {
      let codeBlockMatch = testCases.match(/```(?:markdown)?\s*\n([\s\S]*?)\n```/);
      if (!codeBlockMatch) {
        codeBlockMatch = testCases.match(/```(?:markdown)?\s*\n([\s\S]*?)```/);
      }
      if (!codeBlockMatch) {
        codeBlockMatch = testCases.match(/```(?:markdown)?\s*\n([\s\S]*)$/);
      }
      if (codeBlockMatch && codeBlockMatch[1]) {
        processedContent = codeBlockMatch[1].trim();
        usedCodeBlock = true;
        logger.info('AutomationPlanning: Extracted content from markdown code block', {
          originalLength: testCases.length,
          extractedLength: processedContent.length,
        });
      }
    } else {
      logger.debug('AutomationPlanning: Content starts with #, skipping code block extraction');
    }

    // Remove leading explanatory text: find first #### 测试用例 / #### TC-xxx / #### Test Case
    const firstTestCaseIndex = processedContent.search(/####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case)/i);
    if (firstTestCaseIndex > 0) {
      processedContent = processedContent.substring(firstTestCaseIndex);
      logger.debug('AutomationPlanning: Removed leading text before first test case', {
        removedLength: firstTestCaseIndex,
      });
    } else if (firstTestCaseIndex === -1) {
      logger.info('AutomationPlanning: No #### test case header found, trying section fallbacks');
      // Fallbacks for common TEST doc structures: ## 功能模块, ## 第二部分：测试用例, ### 模块1
      const headerRe = /####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case)/i;
      let sectionMatch = processedContent.match(/##\s+功能模块[\s\S]*?(####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case))/i);
      if (sectionMatch && sectionMatch.index !== undefined) {
        processedContent = processedContent.substring(sectionMatch.index);
        logger.info('AutomationPlanning: Fallback matched ## 功能模块');
      } else {
        sectionMatch = processedContent.match(/##\s+第二部分[：:]?\s*测试用例[\s\S]*?(####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case))/i);
        if (sectionMatch && sectionMatch.index !== undefined) {
          processedContent = processedContent.substring(sectionMatch.index);
          logger.info('AutomationPlanning: Fallback matched ## 第二部分：测试用例');
        } else {
          sectionMatch = processedContent.match(/(###\s+模块\d+[\s\S]*?)(####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case))/i);
          if (sectionMatch && sectionMatch.index !== undefined && sectionMatch[1] !== undefined) {
            const caseStart = sectionMatch.index + sectionMatch[1].length;
            processedContent = processedContent.substring(caseStart);
            logger.info('AutomationPlanning: Fallback matched ### 模块N, jumped to first ####');
          }
        }
      }
      const hasHeaderAfterFallback = processedContent.substring(0, 500).search(headerRe) !== -1;
      if (!hasHeaderAfterFallback) {
        logger.warn('AutomationPlanning: No test case header found after fallbacks', {
          firstTestCaseIndex: -1,
          hasPart2: processedContent.includes('第二部分'),
          hasTC001: processedContent.includes('TC-001'),
        });
      }
    }

    logger.info('AutomationPlanning: Processed content for extraction', {
      processedLength: processedContent.length,
      first100Chars: processedContent.substring(0, 100),
      usedCodeBlock,
    });

    const lines = processedContent.split('\n');

    let currentTestCase: { id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string } | null = null;
    let inSteps = false;
    let inExpectedResults = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Detect test case header - Only match #### (4 hashes) to avoid matching category headers like "### 原有测试用例"
      // Match patterns like: "#### 测试用例1：正常注册流程" or "#### TC-001: Test Case Name"
      if (trimmed.match(/^####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case)/i)) {
        // Save previous test case if exists and has valid data
        if (currentTestCase) {
          // Ensure ID is set before saving
          if (!currentTestCase.id) {
            // Try to extract ID from name
            const nameMatch = currentTestCase.name.match(/TC-[\dA-Z-]+/i);
            if (nameMatch) {
              currentTestCase.id = nameMatch[0];
            } else {
              // Generate ID if not found
              currentTestCase.id = `TC-${String(samples.length + 1).padStart(3, '0')}`;
            }
          }
          // Only save if has valid name and at least some content
          if (currentTestCase.name && currentTestCase.name.trim() && currentTestCase.id) {
            samples.push(currentTestCase);
          }
        }

        // Check if we've reached max count
        if (maxCount && samples.length >= maxCount) {
          break;
        }

        // Start new test case
        currentTestCase = {
          id: '',
          name: trimmed.replace(/^####\s+/, '').trim(),
          steps: [],
          expectedResults: [],
          precondition: '',
        };
        inSteps = false;
        inExpectedResults = false;
        continue;
      }

      // Extract test case ID (TC-XXX format) - must be on a line with "测试用例编号"
      if (trimmed.includes('**测试用例编号**') || trimmed.includes('测试用例编号')) {
        const idMatch = trimmed.match(/TC-[\dA-Z-]+/i);
        if (idMatch && currentTestCase) {
          currentTestCase.id = idMatch[0];
        }
      }

      // Extract precondition (前置条件) - handle both table format and text format
      if (currentTestCase) {
        // Table format: "| 前置条件 | 用户已登录系统 |"
        if (trimmed.startsWith('|') && trimmed.includes('前置条件')) {
          const parts = trimmed
            .split('|')
            .map((p) => p.trim())
            .filter((p) => p);
          const preconditionIndex = parts.findIndex((p) => p.includes('前置条件'));
          if (preconditionIndex >= 0 && preconditionIndex + 1 < parts.length) {
            currentTestCase.precondition = parts[preconditionIndex + 1].trim();
            logger.debug('AutomationPlanning: Extracted precondition from table', {
              testCaseId: currentTestCase.id || 'unknown',
              precondition: currentTestCase.precondition,
            });
          }
        }
        // Text format: "前置条件：用户已登录系统" or "**前置条件**：用户已登录系统"
        else if ((trimmed.includes('**前置条件**') || trimmed.includes('前置条件')) && !trimmed.startsWith('|')) {
          const preconditionMatch = trimmed.match(/前置条件[：:]\s*(.+)/i);
          if (preconditionMatch && preconditionMatch[1]) {
            currentTestCase.precondition = preconditionMatch[1].trim();
            logger.debug('AutomationPlanning: Extracted precondition from text', {
              testCaseId: currentTestCase.id || 'unknown',
              precondition: currentTestCase.precondition,
            });
          }
        }
      }

      // Detect steps section - "测试步骤" / "Steps" / "操作步骤" or BDD-style "When" / "当" / "操作"
      if (trimmed.match(/测试步骤|Steps|操作步骤|\*\*When\*\*|\*\*当\*\*|^When\s*[：:]|\*\*操作\*\*|^操作\s*[：:]/i) && currentTestCase) {
        inSteps = true;
        inExpectedResults = false;
        continue;
      }

      // Reset inSteps when we encounter "预期结果" or BDD "Then" section
      if (trimmed.match(/预期结果|Expected Result|Expected Results|\*\*Then\*\*|\*\*那么\*\*|^Then\s*[：:]|^那么\s*[：:]/i) && currentTestCase) {
        inSteps = false;
        inExpectedResults = true;
        continue;
      }

      // Collect steps: numbered "1. step" or bullet "- step" / "* step" (BDD When list)
      if (inSteps && !inExpectedResults && currentTestCase) {
        // Match numbered steps: "1. step" or "  - 1. step"
        const stepMatch = trimmed.match(/^[\s\-*]*\d+\.\s+(.+)$/);
        if (stepMatch) {
          const step = stepMatch[1].trim();
          if (step && step.length >= 3 && !step.match(/^\*\*.*\*\*$/) && !step.includes('预期结果')) {
            currentTestCase.steps.push(step);
            logger.debug('AutomationPlanning: Extracted test step', {
              testCaseId: currentTestCase.id || 'unknown',
              step: step.substring(0, 50),
            });
          }
          continue;
        }
        // Match bullet list (BDD When style): "- 用户点击..." or "* 打开页面"
        const bulletMatch = trimmed.match(/^\s*[-*]\s+(.+)$/);
        if (bulletMatch) {
          const step = bulletMatch[1].trim();
          if (step && step.length >= 2 && !step.match(/^\*\*.*\*\*$/) && !step.includes('预期结果')) {
            currentTestCase.steps.push(step);
            logger.debug('AutomationPlanning: Extracted test step (bullet)', {
              testCaseId: currentTestCase.id || 'unknown',
              step: step.substring(0, 50),
            });
          }
        }
      }

      // Collect expected results: bullet list in "Then" section (BDD style)
      if (inExpectedResults && currentTestCase) {
        // Match bullet list: "- 提示：登陆成功" or "* 用户处于已登录状态"
        const bulletMatch = trimmed.match(/^\s*[-*]\s+(.+)$/);
        if (bulletMatch) {
          const expectedResult = bulletMatch[1].trim();
          // 清理可能的 markdown 格式（如 **提示**：）
          const cleanedResult = expectedResult.replace(/\*\*/g, '').trim();
          if (cleanedResult && cleanedResult.length >= 2 && !cleanedResult.match(/^\*\*.*\*\*$/)) {
            currentTestCase.expectedResults.push(cleanedResult);
            logger.debug('AutomationPlanning: Extracted expected result', {
              testCaseId: currentTestCase.id || 'unknown',
              expectedResult: cleanedResult.substring(0, 50),
            });
          }
        }
      }
    }

    // Add last test case if exists
    if (currentTestCase) {
      if (!currentTestCase.id) {
        // Try to extract ID from name
        const nameMatch = currentTestCase.name.match(/TC-[\dA-Z-]+/i);
        if (nameMatch) {
          currentTestCase.id = nameMatch[0];
        } else {
          // Generate ID if not found
          currentTestCase.id = `TC-${String(samples.length + 1).padStart(3, '0')}`;
        }
      }
      // Only save if has valid name and ID
      if (currentTestCase.name && currentTestCase.name.trim() && currentTestCase.id) {
        if (!maxCount || samples.length < maxCount) {
          samples.push(currentTestCase);
        }
      }
    }

    // Log extraction results
    const logPayload: Record<string, unknown> = {
      extractedCount: samples.length,
      maxCount: maxCount || 'unlimited',
      testCaseIds: samples.map((tc) => tc.id),
      testCaseNames: samples.map((tc) => tc.name.substring(0, 30)),
      stepsCounts: samples.map((tc) => tc.steps.length),
    };
    if (samples.length === 0) {
      logPayload.diagnostic = {
        processedLength: processedContent.length,
        hasPart2: processedContent.includes('第二部分'),
        hasTC001: processedContent.includes('TC-001'),
      };
    }
    logger.info('AutomationPlanning: Test case extraction completed', logPayload);

    return samples;
  }

  /**
   * Extract URL from test cases if mentioned
   */
  private extractUrlFromTestCases(testCases: string): string | undefined {
    const urlMatch = testCases.match(/https?:\/\/[^\s)]+/i);
    return urlMatch ? urlMatch[0] : undefined;
  }

  /**
   * Build a safe script filename from test case id and name for better distinction in auto/*.json.
   * Format: {id}-{sanitizedName}.json, e.g. TC-001-用户注册-手机号注册成功.json
   */
  private toSafeScriptFilename(id: string, name: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
    if (!name || !name.trim()) {
      return `${safeId}.json`;
    }
    let part = name.trim();
    // Strip leading "TC-xxx：" or "TC-xxx:" to avoid duplication in filename
    part = part.replace(/^\s*TC-[\dA-Z-]+[：:]\s*/i, '').trim();
    if (!part) {
      return `${safeId}.json`;
    }
    // Replace illegal filename chars and normalize spaces to single hyphen
    part = part
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!part) {
      return `${safeId}.json`;
    }
    const maxNameLen = 56;
    if (part.length > maxNameLen) {
      part = part.slice(0, maxNameLen).replace(/-+$/, '');
    }
    return `${safeId}-${part}.json`;
  }

  /**
   * Parse step text to extract action type and params
   * Uses keyword matching to identify action types and extract URL/selector
   * @param stepText - The step description text
   * @returns Object with action type and params (url or selector)
   */
  private parseStepAction(stepText: string): { action: string; params: { url?: string; selector?: string; [key: string]: any } } {
    const lowerStep = stepText.toLowerCase();

    // Extract URL if present
    const urlMatch = stepText.match(/(https?:\/\/[^\s]+)/i);
    const url = urlMatch ? urlMatch[1] : undefined;

    // Extract selector based on keywords
    let selector: string | undefined = undefined;

    // Match action types based on keywords
    if (lowerStep.includes('点击') || lowerStep.includes('click')) {
      // Extract button/element name for selector
      const buttonMatch = stepText.match(/点击["']?([^"'\s]+(?:按钮|button))["']?/i) || stepText.match(/click\s+["']?([^"'\s]+)["']?/i);
      if (buttonMatch) {
        selector = buttonMatch[1];
      } else {
        // Try to extract common button names
        const commonButtons = ['登录', '退出', '提交', '确认', '取消', '保存'];
        for (const btn of commonButtons) {
          if (stepText.includes(btn)) {
            selector = `${btn}按钮`;
            break;
          }
        }
      }
      return { action: 'click', params: selector ? { selector } : {} };
    }

    if (lowerStep.includes('输入') || lowerStep.includes('type') || lowerStep.includes('输入框')) {
      // Extract input field name for selector
      const inputMatch = stepText.match(/(?:在)?([^输入框]+)(?:输入框|输入)/i) || stepText.match(/type\s+["']?([^"'\s]+)["']?/i);
      if (inputMatch) {
        selector = inputMatch[1].trim();
      } else {
        // Try to extract common input names
        const commonInputs = ['账号', '密码', '用户名', '邮箱', '手机号'];
        for (const inp of commonInputs) {
          if (stepText.includes(inp)) {
            selector = `${inp}输入框`;
            break;
          }
        }
      }
      return { action: 'type', params: selector ? { selector } : {} };
    }

    if (lowerStep.includes('打开') || lowerStep.includes('open') || lowerStep.includes('导航') || lowerStep.includes('navigate')) {
      return { action: 'open', params: url ? { url } : {} };
    }

    if (lowerStep.includes('验证') || lowerStep.includes('verify') || lowerStep.includes('检查') || lowerStep.includes('check')) {
      // Extract element name for verification
      const verifyMatch = stepText.match(/验证["']?([^"'\s]+)["']?/i) || stepText.match(/verify\s+["']?([^"'\s]+)["']?/i);
      if (verifyMatch) {
        selector = verifyMatch[1];
      }
      return { action: 'verify', params: selector ? { selector } : {} };
    }

    if (lowerStep.includes('悬停') || lowerStep.includes('hover')) {
      // Extract element name for hover
      const hoverMatch = stepText.match(/悬停在["']?([^"'\s]+)["']?/i) || stepText.match(/hover\s+["']?([^"'\s]+)["']?/i);
      if (hoverMatch) {
        selector = hoverMatch[1];
      }
      return { action: 'hover', params: selector ? { selector } : {} };
    }

    // Default to unknown if no match
    return { action: 'unknown', params: url ? { url } : {} };
  }

  /**
   * Parse expected result string to extract type and value
   * @param expectedText - The expected result text
   * @returns Object with type and value, or null if cannot parse
   */
  private parseExpectedResult(expectedText: string): { type: 'url' | 'text' | 'element' | 'api' | 'cookie' | 'url_match'; value: string } | null {
    if (!expectedText || !expectedText.trim()) {
      return null;
    }

    const lowerText = expectedText.toLowerCase();

    // Cookie type: contains keywords like "cookie", "token", "登录态", "认证", "session"
    // 优先识别登录态特征校验
    if (
      lowerText.includes('cookie') ||
      lowerText.includes('token') ||
      lowerText.includes('登录态') ||
      lowerText.includes('认证') ||
      lowerText.includes('session') ||
      lowerText.includes('auth')
    ) {
      // 提取 cookie 名称（如 token、auth_token 等）
      const cookieNameMatch =
        expectedText.match(/(?:cookie|token|session|auth)[\s:：=]+([a-zA-Z_][a-zA-Z0-9_]*)/i) ||
        expectedText.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:cookie|token|session)/i);
      const value = cookieNameMatch ? cookieNameMatch[1] : lowerText.includes('token') ? 'token' : 'auth_token';
      return { type: 'cookie', value };
    }

    // URL match type: contains keywords like "包含", "匹配", "模糊", "url_match"
    // 用于登录后页面跳转的模糊匹配
    if (lowerText.includes('url_match') || lowerText.includes('url匹配') || lowerText.includes('模糊匹配') || lowerText.includes('包含路径')) {
      // Extract URL pattern
      const urlMatch = expectedText.match(/(https?:\/\/[^\s]+)/i) || expectedText.match(/(\/[^\s]+)/i) || expectedText.match(/([^\s]+)/);
      const value = urlMatch ? urlMatch[1] : expectedText.trim();
      return { type: 'url_match', value };
    }

    // URL type: contains keywords like "跳转", "url", "地址", "跳转到"
    // 注意：登录相关预期优先使用 cookie 或 url_match，避免使用固定 URL
    if (
      lowerText.includes('跳转') ||
      lowerText.includes('url') ||
      lowerText.includes('地址') ||
      lowerText.includes('跳转到') ||
      lowerText.includes('redirect') ||
      lowerText.includes('navigate')
    ) {
      // 如果是登录相关，优先使用 url_match 而不是固定 url
      if (lowerText.includes('登录') || lowerText.includes('login')) {
        const urlMatch = expectedText.match(/(https?:\/\/[^\s]+)/i) || expectedText.match(/(\/[^\s]+)/i);
        const value = urlMatch ? urlMatch[1] : expectedText.trim();
        return { type: 'url_match', value };
      }

      // Extract URL path or full URL
      const urlMatch = expectedText.match(/(https?:\/\/[^\s]+)/i) || expectedText.match(/(\/[^\s]+)/i);
      const value = urlMatch ? urlMatch[1] : expectedText.trim();
      return { type: 'url', value };
    }

    // API type: contains keywords like "接口", "请求", "响应", "api"
    if (
      lowerText.includes('接口') ||
      lowerText.includes('请求') ||
      lowerText.includes('响应') ||
      lowerText.includes('api') ||
      lowerText.includes('request') ||
      lowerText.includes('response')
    ) {
      // Extract API endpoint or status code
      const apiMatch =
        expectedText.match(/(\d{3})/i) || // HTTP status code
        expectedText.match(/(\/api\/[^\s]+)/i) || // API endpoint
        expectedText.match(/([A-Z]+\s+[^\s]+)/i); // HTTP method + endpoint
      const value = apiMatch ? apiMatch[1] : expectedText.trim();
      return { type: 'api', value };
    }

    // Element type: contains keywords like "元素", "按钮", "输入框", "显示", "头像", "用户名"
    // 优先识别登录态特征元素（用户头像、用户名等）
    if (
      lowerText.includes('头像') ||
      lowerText.includes('avatar') ||
      lowerText.includes('用户名') ||
      lowerText.includes('user') ||
      lowerText.includes('profile') ||
      lowerText.includes('用户信息')
    ) {
      // 登录态特征元素
      const elementMatch =
        expectedText.match(/["']?([^"'\s]*(?:头像|用户名|avatar|user|profile))["']?/i) ||
        expectedText.match(/(显示|出现|可见)[^，。；]*(?:头像|用户名)/i);
      const value = elementMatch ? elementMatch[1] || elementMatch[0] : lowerText.includes('头像') ? '用户头像' : '用户名';
      return { type: 'element', value };
    }

    if (
      lowerText.includes('元素') ||
      lowerText.includes('按钮') ||
      lowerText.includes('输入框') ||
      lowerText.includes('element') ||
      lowerText.includes('button') ||
      lowerText.includes('input') ||
      lowerText.includes('显示') ||
      lowerText.includes('出现') ||
      lowerText.includes('可见')
    ) {
      // Extract element name or description
      const elementMatch = expectedText.match(/["']?([^"'\s]+(?:按钮|输入框|元素))["']?/i) || expectedText.match(/(显示|出现|可见)[^，。；]*/i);
      const value = elementMatch ? elementMatch[1] || elementMatch[0] : expectedText.trim();
      return { type: 'element', value };
    }

    // Toast/Text type: 检测 Toast 消息或文本提示
    // 如果是登录相关的 Toast，生成组合断言（Toast waitFor + Cookie expected）
    if (
      lowerText.includes('toast') ||
      lowerText.includes('提示') ||
      lowerText.includes('消息') ||
      lowerText.includes('成功') ||
      lowerText.includes('失败') ||
      lowerText.includes('错误') ||
      lowerText.includes('通知') ||
      lowerText.includes('notification') ||
      lowerText.includes('alert')
    ) {
      // 提取 Toast 文本内容
      const toastTextMatch = expectedText.match(/["']([^"']+)["']/) || expectedText.match(/(提示|消息|成功|失败|错误)[：:：]?\s*([^，。；\n]+)/i);
      const toastText = toastTextMatch ? toastTextMatch[2] || toastTextMatch[1] || expectedText.trim() : expectedText.trim();

      // 如果是登录相关，返回特殊标记，后续处理会生成组合断言
      if (lowerText.includes('登录') || lowerText.includes('login')) {
        // 返回一个特殊对象，标记需要组合断言
        return { type: 'toast_with_login', value: toastText } as any;
      }

      // 其他 Toast 消息，返回 text 类型
      return { type: 'text', value: toastText };
    }

    // Text type: default for other cases (contains "显示", "提示", "文案", "文本")
    // This is the fallback type
    return { type: 'text', value: expectedText.trim() };
  }

  /**
   * Generate JSON format test case files for each test case
   * Returns an array of JSON files with their IDs and content
   * 严格按照测试用例的步骤顺序生成 JSON 文件，确保每个步骤都被正确转换
   */
  private async generateStagehandScripts(
    testCases: Array<{ id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string }>,
    _url?: string,
    _options?: AutomationPlanningOptions
  ): Promise<Array<{ id: string; filename: string; content: string }>> {
    logger.info('AutomationPlanning: generateStagehandScripts method started (generating JSON files)', {
      testCasesCount: testCases.length,
    });
    const scriptFiles: Array<{ id: string; filename: string; content: string }> = [];
    const usedFilenames = new Set<string>();

    try {
      logger.info('AutomationPlanning: Starting to process test cases for JSON generation', {
        totalTestCases: testCases.length,
      });
      let processedCount = 0;
      for (const testCase of testCases) {
        processedCount++;
        logger.debug('AutomationPlanning: Processing test case', {
          index: processedCount,
          total: testCases.length,
          testCaseId: testCase.id,
          testCaseName: testCase.name,
        });
        try {
          // Ensure we have valid test case data
          if (!testCase || !testCase.name) {
            logger.warn('AutomationPlanning: Skipping invalid test case', { testCase });
            continue;
          }

          const scriptId = testCase.id || `TC-${String(scriptFiles.length + 1).padStart(3, '0')}`;
          let filename = this.toSafeScriptFilename(scriptId, testCase.name);
          if (usedFilenames.has(filename)) {
            let suffix = 2;
            while (usedFilenames.has(filename)) {
              const base = filename.replace(/\.json$/, '');
              filename = `${base}_${suffix}.json`;
              suffix += 1;
            }
          }
          usedFilenames.add(filename);
          const safeName = (testCase.name || 'Unknown').trim();
          const safeSteps = (testCase.steps || []).filter((step) => step && step.trim());
          const expectedResults = (testCase.expectedResults || []).filter((er) => er && er.trim());
          const precondition = (testCase.precondition || '').trim();

          // 查找前置用例：如果前置条件包含"登录"或"已登录"，找到登录用例（TC-001）
          // 注意：不能将当前用例自己作为前置条件用例
          // 更严格的匹配：只匹配明确的"已登录"或"登录状态"，排除"登录页面"等不相关的前置条件
          let prerequisiteCase: { id: string; name: string; steps: string[] } | null = null;
          const hasPrerequisiteKeyword =
            precondition &&
            (precondition.includes('已登录') ||
              precondition.includes('登录状态') ||
              precondition.includes('用户已登录') ||
              precondition.includes('logged in') ||
              precondition.includes('login state'));

          // 添加调试日志
          logger.info('AutomationPlanning: Checking prerequisite logic', {
            testCaseId: scriptId,
            testCaseName: safeName,
            precondition,
            hasPrerequisiteKeyword: !!hasPrerequisiteKeyword,
          });

          if (hasPrerequisiteKeyword) {
            // 查找 TC-001（登录用例），但排除当前用例本身
            // 更精确的匹配：优先匹配 TC-001，其次匹配名称包含"登录"但不包含"退出"的用例
            prerequisiteCase =
              testCases.find((tc) => {
                if (tc.id === scriptId) return false; // 排除当前用例
                if (tc.id === 'TC-001') return true; // 优先匹配 TC-001
                // 匹配名称包含"登录"但不包含"退出"的用例
                return tc.name.includes('登录') && !tc.name.includes('退出');
              }) || null;
            if (prerequisiteCase) {
              logger.info('AutomationPlanning: Found prerequisite case for precondition', {
                testCaseId: scriptId,
                precondition,
                prerequisiteCaseId: prerequisiteCase.id,
                prerequisiteCaseName: prerequisiteCase.name,
                prerequisiteStepsCount: prerequisiteCase.steps.length,
              });
            } else {
              logger.warn('AutomationPlanning: No prerequisite case found despite keyword match', {
                testCaseId: scriptId,
                precondition,
                availableTestCaseIds: testCases.map((tc) => tc.id),
              });
            }
          }

          logger.info('AutomationPlanning: Generating JSON for test case', {
            testCaseId: scriptId,
            testCaseName: safeName,
            stepsCount: safeSteps.length,
            steps: safeSteps,
            expectedResultsCount: expectedResults.length,
            expectedResults,
            precondition,
            hasPrerequisite: !!prerequisiteCase,
          });

          // 构建步骤数组：只包含当前测试用例的步骤（不再合并前置条件步骤）
          const allSteps: Array<{
            step: string;
            action: string;
            params: { url?: string; selector?: string; [key: string]: any };
            expected: { type: 'url' | 'text' | 'element' | 'api' | 'cookie' | 'url_match'; value: string } | null;
            status: string;
            error: null;
          }> = [];

          // 添加测试用例步骤（不再添加前置条件步骤）
          const totalStepsCount = safeSteps.length;
          for (let i = 0; i < safeSteps.length; i++) {
            const step = safeSteps[i];
            const trimmedStep = step.trim();
            if (trimmedStep) {
              const { action, params } = this.parseStepAction(trimmedStep);
              const isLastStep = i === totalStepsCount - 1;

              // 最后一个步骤包含预期结果（解析为对象格式）
              let expected: { type: 'url' | 'text' | 'element' | 'api' | 'cookie' | 'url_match'; value: string } | null = null;
              let waitFor: { type: 'toast' | 'element'; text?: string; selector?: string; timeout?: number } | undefined = undefined;

              if (isLastStep && expectedResults.length > 0) {
                const parsedResult = this.parseExpectedResult(expectedResults.join('；'));

                // 检查是否是 Toast + 登录的组合断言
                if (parsedResult && (parsedResult as any).type === 'toast_with_login') {
                  // 生成组合断言：Toast waitFor + Cookie expected
                  waitFor = {
                    type: 'toast',
                    text: parsedResult.value,
                    timeout: 5000,
                  };
                  expected = {
                    type: 'cookie',
                    value: 'token',
                  };
                } else {
                  expected = parsedResult;
                }
              }

              allSteps.push({
                step: trimmedStep,
                action,
                params,
                expected,
                ...(waitFor && { waitFor }),
                status: 'pending',
                error: null,
              });
            }
          }

          // 转换 precondition 为数组格式
          // 如果包含"登录"关键词，转换为 ["login"]
          let preconditionArray: string[] | undefined = undefined;
          if (precondition) {
            const lowerPrecondition = precondition.toLowerCase();
            if (
              lowerPrecondition.includes('已登录') ||
              lowerPrecondition.includes('登录状态') ||
              lowerPrecondition.includes('用户已登录') ||
              lowerPrecondition.includes('logged in') ||
              lowerPrecondition.includes('login state')
            ) {
              preconditionArray = ['login'];
            } else {
              // 保留原始前置条件作为数组元素
              preconditionArray = [precondition];
            }
          }

          // 构建 JSON 对象
          const testCaseJSON = {
            testCase: safeName,
            status: 'pending',
            precondition: preconditionArray, // 改为数组格式
            steps: allSteps,
            duration: 0,
          };

          // 将 JSON 对象序列化为字符串
          const jsonContent = JSON.stringify(testCaseJSON, null, 2);

          scriptFiles.push({
            id: scriptId,
            filename,
            content: jsonContent,
          });

          logger.info('AutomationPlanning: Generated JSON for test case', {
            testCaseId: scriptId,
            filename,
            stepsCount: allSteps.length,
            jsonLength: jsonContent.length,
          });
        } catch (caseError: any) {
          logger.warn('AutomationPlanning: Failed to generate JSON for test case', {
            testCase: testCase.name,
            error: caseError.message,
            stack: caseError.stack,
          });
          // Continue processing other test cases
        }
        logger.debug('AutomationPlanning: Completed processing test case', {
          index: processedCount,
          total: testCases.length,
          testCaseId: testCase.id,
          jsonFilesGeneratedSoFar: scriptFiles.length,
        });
      }
      logger.info('AutomationPlanning: Finished processing all test cases', {
        totalTestCases: testCases.length,
        processedCount,
        generatedJsonFiles: scriptFiles.length,
      });
    } catch (error: any) {
      logger.error('AutomationPlanning: Error generating JSON files', {
        error: error.message,
        stack: error.stack,
        testCasesCount: testCases.length,
        generatedJsonFilesCount: scriptFiles.length,
      });
      // Return empty array instead of throwing - allow process to continue
    }

    logger.info('AutomationPlanning: Completed generating JSON files', {
      totalTestCases: testCases.length,
      generatedJsonFiles: scriptFiles.length,
      testCaseIds: scriptFiles.map((s) => s.id),
      filenames: scriptFiles.map((s) => s.filename),
    });

    logger.info('AutomationPlanning: generateStagehandScripts method returning', {
      returnValueLength: scriptFiles.length,
    });

    return scriptFiles;
  }
}
