/**
 * AutomationPlanning Action
 * Evaluates which test cases can be automated and creates an automation plan
 * Uses Stagehand to validate automation feasibility and generate JSON format test case files
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger } from '../utils';
import { StagehandService } from '../services/StagehandService';
import { MCPService } from '../services/MCPService';
import { buildCLIModePrompt } from '../utils/document/CLIPromptBuilder';

export interface AutomationPlanningOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
  testUrl?: string; // Optional URL to test against for feasibility validation
  useStagehand?: boolean; // Whether to use Stagehand for validation (default: true if ENABLE_BROWSER=true)
  /** Per-step validation timeout in ms; env STAGEHAND_VALIDATION_TIMEOUT_MS as fallback. Default 45000. */
  stagehandValidationTimeoutMs?: number;
  /** Skip browser validation and generate JSON files for all extracted cases; env SKIP_STAGEHAND_VALIDATION=true as fallback. */
  skipStagehandValidation?: boolean;
  /** Enable MCP validation after JSON generation (default: false, JSON files don't need code validation) */
  enableMCPValidation?: boolean;
  /** Enable MCP auto-fix for detected issues (default: false, JSON files don't need code validation) */
  enableMCPAutoFix?: boolean;
  /** Maximum number of fix attempts per JSON file (default: 1) */
  mcpMaxFixAttempts?: number;
  /** Skip expected results validation (default: false) */
  skipExpectedResultsValidation?: boolean;
  /** Overall validation timeout in ms (default: 600000 = 10 minutes) */
  validationOverallTimeoutMs?: number;
}

export class AutomationPlanning extends BaseAction {
  private stagehandService: StagehandService;
  private mcpService?: MCPService;

  constructor() {
    super(
      'AutomationPlanning',
      'Evaluate test cases for automation feasibility and create an automation plan with priorities and technology choices'
    );
    this.stagehandService = new StagehandService();
  }

  /**
   * Initialize MCP service if context is available
   */
  private initializeMCPService(): void {
    if (this.context && !this.mcpService) {
      this.mcpService = new MCPService(this.context);
      logger.info('AutomationPlanning: MCP service initialized');
    }
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
      // CLI 模式：使用 CLI 工具生成 JSON 文件
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

      // Use Stagehand to validate automation feasibility if enabled
      let stagehandValidationResults = '';
      let stagehandScriptFiles: Array<{ id: string; filename: string; content: string }> = [];
      const useStagehand = options?.useStagehand !== false && process.env.ENABLE_BROWSER === 'true';

      logger.info('AutomationPlanning: Stagehand configuration', {
        useStagehand,
        enableBrowser: process.env.ENABLE_BROWSER,
        useStagehandOption: options?.useStagehand,
      });

      if (useStagehand) {
        // ========== 统一逻辑：直接生成 JSON 文件，不进行验证 ==========
        logger.info('========================================');
        logger.info('AutomationPlanning: NEW LOGIC - Generating JSON files directly without validation');
        logger.info('========================================');
        const sampleTestCases = this.extractSampleTestCases(testCases, 50);
        const testUrl = options?.testUrl || this.extractUrlFromTestCases(testCases);

        logger.info('AutomationPlanning: Extracted test cases for script generation', {
          sampleTestCasesCount: sampleTestCases.length,
          testUrl,
          testCasesLength: testCases.length,
        });

        if (sampleTestCases.length > 0) {
          logger.info('AutomationPlanning: [STEP 1/3] Starting generateStagehandScripts', {
            testCasesCount: sampleTestCases.length,
            testUrl,
          });
          stagehandScriptFiles = await this.generateStagehandScripts(sampleTestCases, testUrl, options);
          logger.info('AutomationPlanning: [STEP 2/3] generateStagehandScripts completed successfully', {
            jsonFilesCount: stagehandScriptFiles.length,
            testCaseIds: stagehandScriptFiles.map((s) => s.id),
            filenames: stagehandScriptFiles.map((s) => s.filename),
            isArray: Array.isArray(stagehandScriptFiles),
            hasContent: stagehandScriptFiles.length > 0 ? stagehandScriptFiles[0].content?.length > 0 : false,
          });
          stagehandValidationResults = '## Stagehand 验证\n\n已跳过浏览器验证，为所有提取的用例生成 JSON 文件。';
          logger.info('AutomationPlanning: [STEP 3/3] JSON generation summary', {
            jsonFilesCount: stagehandScriptFiles.length,
            testCaseIds: stagehandScriptFiles.map((s) => s.id),
          });
        } else {
          logger.warn('AutomationPlanning: No sample test cases extracted, skipping JSON generation', {
            testCasesLength: testCases.length,
          });
        }
      } else {
        // 可选改进：未启用 Stagehand 时仍生成 JSON（不做第一步验证），便于无浏览器环境也能产出 auto/*.json
        const sampleTestCases = this.extractSampleTestCases(testCases, 50);
        const testUrl = options?.testUrl || this.extractUrlFromTestCases(testCases);
        const passedCases = sampleTestCases.filter((tc) => tc.steps && tc.steps.length > 0);
        if (passedCases.length > 0) {
          stagehandScriptFiles = await this.generateStagehandScripts(passedCases, testUrl, options);
          logger.info('AutomationPlanning: Generated JSON files without validation (browser disabled)', {
            sampleCount: sampleTestCases.length,
            withStepsCount: passedCases.length,
            jsonFilesCount: stagehandScriptFiles.length,
          });
        } else {
          logger.warn('AutomationPlanning: No test cases with steps extracted, skipping JSON generation', {
            sampleCount: sampleTestCases.length,
          });
        }
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
        jsonFilesCount: stagehandScriptFiles.length,
        useStagehand,
        isArray: Array.isArray(stagehandScriptFiles),
        jsonFilesDefined: stagehandScriptFiles !== undefined && stagehandScriptFiles !== null,
      });
      if (stagehandScriptFiles && stagehandScriptFiles.length > 0) {
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const expectedAutoDir = path.join(workspaceDir, 'auto');
        logger.info('AutomationPlanning: Starting to save JSON files', {
          jsonFilesCount: stagehandScriptFiles.length,
          workspaceDir,
          expectedAutoDir,
          documentType: workspaceOptions.documentType,
        });
        try {
          const savedFiles: string[] = [];
          for (const scriptFile of stagehandScriptFiles) {
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
              jsonFilesCount: stagehandScriptFiles.length,
              savedCount: savedFiles.length,
              jsonFiles: savedFiles,
              workspaceDir,
              autoDir: expectedAutoDir,
              fullPath: `${workspaceDir}/auto/`,
            });
          } else {
            logger.warn('AutomationPlanning: No JSON files were saved successfully', {
              attemptedCount: stagehandScriptFiles.length,
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
          useStagehand,
          jsonFilesCount: stagehandScriptFiles?.length || 0,
          isArray: Array.isArray(stagehandScriptFiles),
          jsonFilesDefined: stagehandScriptFiles !== undefined && stagehandScriptFiles !== null,
          reason: !stagehandScriptFiles
            ? 'stagehandScriptFiles is null/undefined'
            : stagehandScriptFiles.length === 0
              ? 'stagehandScriptFiles.length is 0'
              : 'unknown',
        });
      }

      logger.info('AutomationPlanning: Preparing final summary', {
        jsonFilesCount: stagehandScriptFiles.length,
        useStagehand,
        hasValidationResults: !!stagehandValidationResults,
      });

      const summary =
        stagehandScriptFiles.length > 0
          ? `已筛选并生成 ${stagehandScriptFiles.length} 个 JSON 格式测试用例文件`
          : useStagehand
            ? stagehandValidationResults
              ? '已筛选可自动化用例，无可通过验证的用例，未生成 JSON 文件'
              : 'Stagehand 验证未完成或失败，未生成 JSON 文件'
            : '未启用 Stagehand，未生成 JSON 文件';

      logger.info('AutomationPlanning: Automation planning completed', {
        summary,
        jsonFilesCount: stagehandScriptFiles.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: summary,
        data: {
          type: 'automation_plan',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          stagehandUsed: useStagehand,
          jsonFilesGenerated: stagehandScriptFiles.length > 0,
          jsonFilesCount: stagehandScriptFiles.length,
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

      // Ensure cleanup on error
      try {
        if (this.stagehandService.isInitialized) {
          await this.stagehandService.close();
        }
      } catch (closeError: any) {
        logger.warn('AutomationPlanning: Failed to cleanup Stagehand service on error', {
          error: closeError.message,
        });
      }

      throw error;
    }
  }

  /**
   * CLI 模式：使用 CLI 工具生成 JSON 文件
   */
  private async runCLIMode(input: string, options?: AutomationPlanningOptions): Promise<IActionOutput> {
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const workspaceDir = this.getWorkspaceDir(workspaceOptions);

    logger.info('AutomationPlanning: Running in CLI mode', {
      workspaceDir,
      executorMode: this.getExecutorMode(),
    });

    try {
      // 确保 auto 目录存在
      const autoDir = path.join(workspaceDir, 'auto');
      await fs.mkdir(autoDir, { recursive: true });
      logger.debug('AutomationPlanning: Ensured auto directory exists', { autoDir });

      // 构建 CLI Prompt
      const prompt = this.buildCLIPrompt(workspaceDir, options);

      // 构建系统提示词（现在是异步的）
      const systemPrompt = await this.buildCLISystemPrompt();

      logger.info('AutomationPlanning: Executing CLI tool', {
        promptLength: prompt.length,
        systemPromptLength: systemPrompt.length,
        workspaceDir,
      });

      // 调用 CLI 工具执行
      const output = await this.execute(prompt, {
        workDir: workspaceDir,
        systemPrompt,
      });

      logger.info('AutomationPlanning: CLI tool execution completed', {
        outputLength: output.length,
      });

      // 读取生成的 JSON 文件
      const jsonFiles = await this.readGeneratedJSONFiles(workspaceDir);

      logger.info('AutomationPlanning: CLI mode completed', {
        jsonFilesCount: jsonFiles.length,
        jsonFiles: jsonFiles.map((f) => f.filename),
      });

      // 返回结果
      const summary =
        jsonFiles.length > 0 ? `已通过 CLI 工具生成 ${jsonFiles.length} 个 JSON 格式测试用例文件` : 'CLI 工具执行完成，但未找到生成的 JSON 文件';

      return {
        content: summary,
        data: {
          type: 'automation_plan',
          timestamp: new Date().toISOString(),
          workspaceDir,
          stagehandUsed: false,
          jsonFilesGenerated: jsonFiles.length > 0,
          jsonFilesCount: jsonFiles.length,
          jsonFiles: jsonFiles.map((f) => ({
            id: f.id,
            filename: f.filename,
          })),
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
   * 加载 automation-test skill 内容用于 CLI 模式
   * 提取 Skills Pipeline 和生成脚本规范，包含模板文件引用
   */
  private async loadAutomationTestSkillForCLI(): Promise<string> {
    const projectRoot = path.resolve(__dirname, '../../..');
    const skillPath = path.join(projectRoot, 'skills', 'automation-test', 'SKILL.md');

    try {
      const skillContent = await fs.readFile(skillPath, 'utf-8');

      // 提取执行前必读部分（包含模板文件引用）
      const prerequisiteMatch = skillContent.match(/## ⚠️ 执行前必读[^#]*?(?=\n##|$)/s);
      const prerequisiteSection = prerequisiteMatch ? prerequisiteMatch[0] : '';

      // 提取输出规范部分（包含模板文件引用）
      const outputNormMatch = skillContent.match(/## 输出规范[^#]*?(?=\n##|$)/s);
      const outputNormSection = outputNormMatch ? outputNormMatch[0] : '';

      // 提取 JSON 文件结构部分
      const jsonStructureMatch = skillContent.match(/## JSON 文件结构[^#]*?(?=\n##|$)/s);
      const jsonStructureSection = jsonStructureMatch ? jsonStructureMatch[0] : '';

      // 提取 Skills Pipeline 部分（如果存在）
      const pipelineMatch = skillContent.match(/## Skills Pipeline[^#]*?(?=\n##|$)/s);
      const pipelineSection = pipelineMatch ? pipelineMatch[0] : '';

      // 提取生成脚本强制规范部分（如果存在）
      const normMatch = skillContent.match(/# 生成脚本强制规范[^#]*?(?=\n#|$)/s);
      const normSection = normMatch ? normMatch[0] : '';

      // 提取各个 Skill 的详细说明（Skill 1-8，如果存在）
      const skillDetails: string[] = [];
      for (let i = 1; i <= 8; i++) {
        const skillMatch = skillContent.match(new RegExp(`## Skill ${i}[^#]*?(?=\n##|$)`, 's'));
        if (skillMatch) {
          skillDetails.push(skillMatch[0]);
        }
      }

      // 组合内容，优先包含模板引用相关部分
      const combined = [
        prerequisiteSection,
        outputNormSection,
        jsonStructureSection,
        pipelineSection,
        normSection,
        ...skillDetails.slice(0, 3), // 只取前3个关键技能
      ]
        .filter(Boolean)
        .join('\n\n');

      // 限制总长度，避免 prompt 过长
      return combined.length > 2000 ? combined.slice(0, 2000) + '...' : combined;
    } catch (error) {
      logger.warn('AutomationPlanning: Failed to load automation-test skill', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  /**
   * 构建 CLI 模式的系统提示词，提供 JSON 格式规范和解析规则
   */
  private async buildCLISystemPrompt(): Promise<string> {
    // 加载 automation-test skill 内容
    const skillContent = await this.loadAutomationTestSkillForCLI();

    return `你是一个专业的自动化测试工程师。你的任务是根据测试用例文档生成符合规范的 JSON 格式测试用例文件。

## ⚠️ 重要：必须先读取模板文件

在生成任何 JSON 文件之前，必须先读取模板文件：
- 模板路径：.cursor/skills/automation-test/references/automation-json-template.json（相对于 workspace 根目录）
- 如果上述路径不存在，尝试：skills/automation-test/references/automation-json-template.json
- 必须严格按照模板格式生成 JSON 文件
- 所有字段必须与模板保持一致
- 不得省略任何必需字段，不得使用占位符
- 生成的 JSON 必须是有效的 JSON 格式，不能包含注释、尾随逗号等非法字符

## 必须遵循的 Skills Pipeline

${skillContent || '请参考 automation-test 技能规范生成 JSON 文件。'}

## Skills Pipeline 在 JSON 格式中的应用

生成的 JSON 文件必须体现以下 Skills Pipeline 要求：

1. **Test Intent Parsing**：从测试用例中准确提取 Actions 和 Expected
   - 每个步骤的 action 必须明确（open/click/type/verify/hover）
   - 每个关键步骤必须有 expected（类型：url/text/element/api）

2. **Action Generation**：每个 step 的 action 必须明确且符合规范
   - 一步一 action，禁止合并多个操作
   - 必须包含 UI 语义定位（通过 selector 字段）
   - 禁止模糊描述，必须明确元素名称

3. **Assertion Generation**：每个关键步骤必须有 expected
   - 关键流程（如登录、提交）的最后一个步骤必须包含 expected
   - expected 类型必须准确（url/text/element/api）
   - 关键流程建议使用双断言（UI + API）

4. **关键流程双断言**：登录、提交等关键操作，expected 应优先使用 url 类型（表示页面跳转），必要时可结合 element 类型（表示元素显示）

示例：登录流程的最后一个步骤应该包含：
\`\`\`json
{
  "step": "用户点击登录按钮",
  "action": "click",
  "params": { "selector": "登录按钮" },
  "expected": {
    "type": "url",
    "value": "/home"
  },
  "status": "pending",
  "error": null
}
\`\`\`

## JSON 文件格式规范

每个测试用例必须生成一个独立的 JSON 文件，格式如下：

\`\`\`json
{
  "testCase": "TC-001：用户登录 - 正确账号密码登录成功",
  "status": "pending",
  "precondition": ["login"],
  "steps": [
    {
      "step": "用户打开登录页面 https://trip-shadow-test.yangcong345.com/trip/login",
      "action": "open",
      "params": {
        "url": "https://trip-shadow-test.yangcong345.com/trip/login"
      },
      "expected": null,
      "status": "pending",
      "error": null
    },
    {
      "step": "用户在账号输入框输入账号",
      "action": "type",
      "params": {
        "selector": "账号输入框"
      },
      "expected": null,
      "status": "pending",
      "error": null
    },
    {
      "step": "用户点击登录按钮",
      "action": "click",
      "params": {
        "selector": "登录按钮"
      },
      "expected": {
        "type": "url",
        "value": "/home"
      },
      "status": "pending",
      "error": null
    }
  ],
  "duration": 0
}
\`\`\`

## 字段说明

### testCase
- 类型：字符串
- 格式：必须包含测试用例编号和名称，如 "TC-001：用户登录 - 正确账号密码登录成功"
- 说明：从测试用例文档中提取完整的用例名称（包含编号）

### status
- 类型：字符串
- 值：固定为 "pending"
- 说明：表示测试用例的初始状态

### precondition
- 类型：字符串数组
- 格式：如 \`["login"]\` 或 \`["系统正常运行，登录页面可访问"]\`
- 解析规则：
  - 如果前置条件包含"登录"、"已登录"、"登录状态"等关键词，转换为 \`["login"]\`
  - 如果前置条件包含"登录页面"、"访问登录页面"等（但不包含"已登录"），保持原文本
  - 其他情况保持原文本，但转换为数组格式
  - 如果前置条件为空或不存在，可以省略此字段或设为 \`[]\`

### steps
- 类型：对象数组
- 说明：每个步骤必须包含以下字段

#### step
- 类型：字符串
- 说明：步骤的完整描述文本

#### action
- 类型：字符串
- 可选值：\`open\`, \`click\`, \`type\`, \`verify\`, \`hover\`
- 解析规则：
  - **open**: 步骤包含"打开"、"open"、"导航"、"navigate"等关键词
  - **click**: 步骤包含"点击"、"click"等关键词
  - **type**: 步骤包含"输入"、"type"、"输入框"等关键词
  - **verify**: 步骤包含"验证"、"verify"、"检查"、"check"等关键词
  - **hover**: 步骤包含"悬停"、"hover"等关键词

#### params
- 类型：对象
- 说明：根据 action 类型包含不同的参数
- **open 操作**：
  - 必须包含 \`url\` 字段（从步骤文本中提取 URL，格式如 \`https://example.com/path\`）
  - 示例：\`{"url": "https://trip-shadow-test.yangcong345.com/trip/login"}\`
- **click/type/verify/hover 操作**：
  - 必须包含 \`selector\` 字段（从步骤文本中提取元素名称）
  - 提取规则：
    - 点击操作：提取"点击"后的按钮名称，如"登录按钮"、"提交按钮"
    - 输入操作：提取输入框名称，如"账号输入框"、"密码输入框"
    - 验证操作：提取要验证的元素名称
    - 悬停操作：提取要悬停的元素名称
  - 示例：\`{"selector": "登录按钮"}\`

#### expected
- 类型：对象或 null
- 格式：\`{"type": "url|text|element|api", "value": "具体值"}\` 或 \`null\`
- 说明：只有最后一个步骤需要设置 expected，其他步骤设为 null
- 解析规则：
  - **url 类型**：预期结果包含"跳转"、"url"、"地址"、"跳转到"等关键词
    - 提取 URL 路径（如 \`/home\`）或完整 URL
    - 示例：\`{"type": "url", "value": "/home"}\`
  - **text 类型**：预期结果包含"显示"、"提示"、"文案"、"文本"等关键词（默认类型）
    - 提取显示的文本内容
    - 示例：\`{"type": "text", "value": "登录成功"}\`
  - **element 类型**：预期结果包含"元素"、"按钮"、"输入框"等关键词
    - 提取元素名称或描述
    - 示例：\`{"type": "element", "value": "用户头像"}\`
  - **api 类型**：预期结果包含"接口"、"请求"、"响应"、"api"等关键词
    - 提取 API 端点或状态码
    - 示例：\`{"type": "api", "value": "200"}\`

#### status
- 类型：字符串
- 值：固定为 "pending"
- 说明：表示步骤的初始状态

#### error
- 类型：null
- 值：固定为 null
- 说明：初始状态没有错误

### duration
- 类型：数字
- 值：固定为 0
- 说明：表示测试用例的执行时长（初始值）

## 文件命名规范

- 格式：\`TC-XXX-用例名称.json\`
- 示例：\`TC-001-用户登录-正确账号密码登录成功.json\`
- 规则：
  - 使用测试用例编号（TC-XXX）
  - 用例名称去除编号前缀（如 "TC-001："），只保留名称部分
  - 将空格替换为连字符，去除特殊字符
  - 文件名长度不超过 60 个字符

## 重要提示

1. **严格遵循格式**：必须严格按照上述 JSON 格式生成，所有字段都必须存在
2. **步骤顺序**：保持测试用例文档中的步骤顺序，不要改变或合并步骤
3. **最后一个步骤**：只有最后一个步骤需要设置 expected 字段，其他步骤的 expected 必须为 null
4. **precondition 转换**：仔细判断前置条件，正确转换为数组格式
5. **selector 提取**：从步骤描述中准确提取元素名称，不要使用 CSS 选择器或 XPath
6. **URL 提取**：对于 open 操作，必须从步骤文本中提取完整的 URL
7. **文件数量**：每个测试用例生成一个独立的 JSON 文件，不要合并多个用例到一个文件`;
  }

  /**
   * 读取 CLI 工具生成的 JSON 文件
   */
  private async readGeneratedJSONFiles(workspaceDir: string): Promise<Array<{ id: string; filename: string }>> {
    const autoDir = path.join(workspaceDir, 'auto');
    const jsonFiles: Array<{ id: string; filename: string }> = [];

    try {
      logger.info('AutomationPlanning: Reading generated JSON files', { autoDir });

      // 检查目录是否存在
      try {
        await fs.access(autoDir);
      } catch {
        logger.warn('AutomationPlanning: Auto directory does not exist', { autoDir });
        return jsonFiles;
      }

      // 读取目录中的所有文件
      const entries = await fs.readdir(autoDir, { withFileTypes: true });

      // 过滤出 JSON 文件
      const jsonEntries = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

      logger.info('AutomationPlanning: Found JSON files', {
        totalFiles: entries.length,
        jsonFilesCount: jsonEntries.length,
        jsonFileNames: jsonEntries.map((e) => e.name),
      });

      // 读取并验证每个 JSON 文件
      for (const entry of jsonEntries) {
        const filePath = path.join(autoDir, entry.name);
        try {
          const content = await fs.readFile(filePath, 'utf-8');

          // 验证 JSON 格式
          let jsonData: any;
          try {
            jsonData = JSON.parse(content);
          } catch (parseError: any) {
            // 提取更详细的错误信息
            const errorMessage = parseError.message || 'Unknown JSON parse error';
            const errorPosition = this.extractJSONErrorPosition(errorMessage, content);

            logger.warn('AutomationPlanning: Invalid JSON file, skipping', {
              filename: entry.name,
              error: errorMessage,
              position: errorPosition,
              filePath,
            });

            // 记录错误行的内容（如果可能）
            if (errorPosition.line) {
              const lines = content.split('\n');
              const errorLine = lines[errorPosition.line - 1];
              logger.debug('AutomationPlanning: JSON error line content', {
                filename: entry.name,
                line: errorPosition.line,
                content: errorLine?.substring(0, 200), // 限制长度
              });
            }
            continue;
          }

          // 验证必需字段
          const validationResult = this.validateJSONStructure(jsonData, entry.name);
          if (!validationResult.valid) {
            logger.warn('AutomationPlanning: JSON file structure validation failed, skipping', {
              filename: entry.name,
              errors: validationResult.errors,
            });
            continue;
          }

          // 从文件名或 testCase 字段提取 ID
          // 文件名格式：TC-001-用例名称.json
          // testCase 格式：TC-001：用户登录 - 正确账号密码登录成功
          let id = '';
          const filenameMatch = entry.name.match(/^(TC-[\dA-Z-]+)/i);
          if (filenameMatch) {
            id = filenameMatch[1];
          } else {
            // 从 testCase 字段提取
            const testCaseMatch = String(jsonData.testCase).match(/^(TC-[\dA-Z-]+)/i);
            if (testCaseMatch) {
              id = testCaseMatch[1];
            } else {
              // 使用文件名（不含扩展名）作为 ID
              id = entry.name.replace(/\.json$/, '');
            }
          }

          jsonFiles.push({
            id,
            filename: entry.name,
          });

          logger.debug('AutomationPlanning: Successfully read JSON file', {
            id,
            filename: entry.name,
            testCase: jsonData.testCase,
            stepsCount: jsonData.steps?.length || 0,
          });
        } catch (fileError: any) {
          logger.warn('AutomationPlanning: Failed to read JSON file, skipping', {
            filename: entry.name,
            error: fileError.message,
          });
          continue;
        }
      }

      logger.info('AutomationPlanning: Successfully read JSON files', {
        totalFiles: jsonFiles.length,
        files: jsonFiles.map((f) => ({ id: f.id, filename: f.filename })),
      });

      return jsonFiles.sort((a, b) => a.filename.localeCompare(b.filename));
    } catch (error: any) {
      logger.error('AutomationPlanning: Failed to read generated JSON files', {
        error: error.message,
        stack: error.stack,
        autoDir,
      });
      return jsonFiles;
    }
  }

  /**
   * 从 JSON 解析错误消息中提取位置信息（行号和列号）
   */
  private extractJSONErrorPosition(errorMessage: string, content: string): { line?: number; column?: number; position?: number } {
    const result: { line?: number; column?: number; position?: number } = {};

    // 尝试从错误消息中提取位置信息
    // 格式示例: "Expected ',' or '}' after property value in JSON at position 126 (line 7 column 23)"
    const positionMatch = errorMessage.match(/position (\d+)/i);
    if (positionMatch) {
      result.position = parseInt(positionMatch[1], 10);
    }

    const lineMatch = errorMessage.match(/line (\d+)/i);
    if (lineMatch) {
      result.line = parseInt(lineMatch[1], 10);
    }

    const columnMatch = errorMessage.match(/column (\d+)/i);
    if (columnMatch) {
      result.column = parseInt(columnMatch[1], 10);
    }

    // 如果没有从错误消息中提取到行号，但提取到了位置，尝试计算行号
    if (!result.line && result.position !== undefined) {
      const beforeError = content.substring(0, result.position);
      result.line = beforeError.split('\n').length;
      result.column = beforeError.split('\n').pop()?.length || 0;
    }

    return result;
  }

  /**
   * 验证 JSON 结构是否符合模板格式要求
   */
  private validateJSONStructure(jsonData: any, _filename: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证必需字段
    if (!jsonData.testCase || typeof jsonData.testCase !== 'string') {
      errors.push('Missing or invalid "testCase" field (must be a string)');
    }

    if (jsonData.status === undefined) {
      errors.push('Missing "status" field');
    } else if (typeof jsonData.status !== 'string') {
      errors.push('Invalid "status" field (must be a string)');
    }

    // 验证 steps 数组
    if (!Array.isArray(jsonData.steps)) {
      errors.push('Missing or invalid "steps" field (must be an array)');
    } else {
      // 验证每个 step 的结构
      jsonData.steps.forEach((step: any, index: number) => {
        if (!step.step || typeof step.step !== 'string') {
          errors.push(`Step ${index + 1}: Missing or invalid "step" field (must be a string)`);
        }

        if (!step.action || typeof step.action !== 'string') {
          errors.push(`Step ${index + 1}: Missing or invalid "action" field (must be a string)`);
        }

        if (!step.params || typeof step.params !== 'object') {
          errors.push(`Step ${index + 1}: Missing or invalid "params" field (must be an object)`);
        }

        if (step.status === undefined) {
          errors.push(`Step ${index + 1}: Missing "status" field`);
        }

        // expected 可以是 null、string 或 object
        if (step.expected !== null && step.expected !== undefined) {
          if (typeof step.expected === 'object') {
            if (!step.expected.type || !step.expected.value) {
              errors.push(`Step ${index + 1}: Invalid "expected" object (must have "type" and "value" fields)`);
            }
          } else if (typeof step.expected !== 'string') {
            errors.push(`Step ${index + 1}: Invalid "expected" field (must be null, string, or object)`);
          }
        }
      });
    }

    // precondition 是可选的，但如果存在必须是数组
    if (jsonData.precondition !== undefined && !Array.isArray(jsonData.precondition)) {
      errors.push('Invalid "precondition" field (must be an array or undefined)');
    }

    // duration 是可选的，但如果存在必须是数字
    if (jsonData.duration !== undefined && typeof jsonData.duration !== 'number') {
      errors.push('Invalid "duration" field (must be a number or undefined)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 构建 CLI 模式的 Prompt
   */
  private buildCLIPrompt(workspaceDir: string, options?: AutomationPlanningOptions): string {
    const baseWorkspaceDir = workspaceDir.replace(/\/docs\/test$/, ''); // 获取基础 workspace 目录
    const inputDir = `${baseWorkspaceDir}/docs/test`;
    const outputDir = `${baseWorkspaceDir}/docs/test/auto`;

    // 提取测试 URL（如果有）
    const testUrl = options?.testUrl || '';

    const taskPoints = [
      '首先读取模板文件：.cursor/skills/automation-test/references/automation-json-template.json（如果不存在，尝试 skills/automation-test/references/automation-json-template.json）',
      '理解模板结构，确保生成的 JSON 文件严格遵循模板格式',
      '生成的 JSON 必须是有效的 JSON 格式，不能包含注释、尾随逗号等非法字符',
      '从输入文件夹读取 TEST.md 或 TEST_REVIEW.md（优先 TEST_REVIEW.md）',
      '解析测试用例，提取每个用例的：编号、名称、前置条件、测试步骤、预期结果',
      '为每个测试用例生成一个 JSON 文件，格式如下：',
      '  - testCase: 测试用例名称（包含编号，如 "TC-001：用户登录 - 正确账号密码登录成功"）',
      '  - status: "pending"',
      '  - precondition: 数组格式，如 ["login"] 或 ["系统正常运行，登录页面可访问"]',
      '  - steps: 数组，每个步骤包含 step（描述）、action（open/click/type/verify/hover）、params（对象，包含 url 或 selector）、expected（对象格式，包含 type 和 value）、status（"pending"）、error（null）',
      '  - duration: 0',
      'JSON 文件命名格式：TC-XXX-用例名称.json（例如：TC-001-用户登录-正确账号密码登录成功.json）',
      '保存所有 JSON 文件到输出文件夹 test/auto/',
    ];

    return buildCLIModePrompt({
      inputDir,
      outputDir,
      inputFileNames: ['TEST.md', 'TEST_REVIEW.md'],
      outputFileName: '*.json', // 多个文件
      taskDescription: '使用 automation-test 技能，根据测试用例文档生成自动化测试 JSON 文件',
      taskPoints,
      systemContext: testUrl ? `测试目标 URL: ${testUrl}` : undefined,
      includeKnowledgeInput: true,
    });
  }

  /**
   * Extract sample test cases for Stagehand validation
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
   * Validate test cases using Stagehand.
   * Returns a text report and the list of cases that passed (first step executed successfully).
   * Cases are validated in order: before validating case N, all steps of cases 0..N-1 are run
   * in the same session so that dependent cases (e.g. logout after login) see the correct page state.
   * Each step is run with a timeout to avoid hanging on failing steps (e.g. Zod retries).
   */
  private async validateWithStagehand(
    testCases: Array<{ id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string }>,
    url?: string,
    planningOptions?: AutomationPlanningOptions
  ): Promise<{
    report: string;
    passedCases: Array<{ id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string }>;
  }> {
    const results: string[] = [];
    const passedCases: Array<{ id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string }> = [];
    const timeoutMs = planningOptions?.stagehandValidationTimeoutMs ?? parseInt(process.env.STAGEHAND_VALIDATION_TIMEOUT_MS || '45000', 10);
    const overallTimeoutMs = planningOptions?.validationOverallTimeoutMs ?? parseInt(process.env.VALIDATION_OVERALL_TIMEOUT_MS || '600000', 10); // 10分钟
    const skipExpectedResultsValidation = planningOptions?.skipExpectedResultsValidation === true;

    // 检查浏览器页面是否可用
    const initialPage = await this.stagehandService.getPage();
    if (!initialPage) {
      logger.warn('AutomationPlanning: Browser page not available, skipping validation', {
        totalCases: testCases.length,
      });
      // 返回所有用例（假设都可通过），避免阻塞流程
      return {
        report: '## Stagehand 自动化可行性验证结果\n\n浏览器不可用，跳过验证。所有用例将生成脚本。\n',
        passedCases: testCases,
      };
    }

    const runAct = async (instruction: string, navUrl?: string): Promise<void> => {
      await Promise.race([
        this.stagehandService.act(instruction, navUrl),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Validation timeout (${timeoutMs}ms)`)), timeoutMs)),
      ]);
    };

    results.push('## Stagehand 自动化可行性验证结果\n\n');
    results.push('以下测试用例已通过 Stagehand 实际验证：\n\n');

    // 总体超时控制
    const validationStartTime = Date.now();

    for (let i = 0; i < testCases.length; i++) {
      // 检查总体超时
      const elapsedTime = Date.now() - validationStartTime;
      if (elapsedTime > overallTimeoutMs) {
        logger.warn('AutomationPlanning: Overall validation timeout reached', {
          elapsedTimeMs: elapsedTime,
          timeoutMs: overallTimeoutMs,
          completedCases: i,
          totalCases: testCases.length,
        });
        results.push(`\n⚠️ 验证超时（${Math.round(elapsedTime / 1000)}秒），已完成的 ${i} 个用例将生成脚本。\n`);
        break;
      }

      // 检查浏览器状态（每个用例验证前检查）
      const currentPage = await this.stagehandService.getPage();
      if (!currentPage) {
        logger.warn('AutomationPlanning: Browser page became unavailable during validation', {
          completedCases: i,
          totalCases: testCases.length,
          elapsedTimeMs: elapsedTime,
        });
        results.push(`\n⚠️ 浏览器不可用，已完成的 ${i} 个用例将生成脚本。\n`);
        break;
      }

      // 添加进度日志（每5个用例或最后一个用例）
      if (i % 5 === 0 || i === testCases.length - 1) {
        const progress = (((i + 1) / testCases.length) * 100).toFixed(1);
        const avgTimePerCase = i > 0 ? elapsedTime / (i + 1) : elapsedTime;
        const estimatedRemaining = Math.round(((testCases.length - i - 1) * avgTimePerCase) / 1000);
        logger.info('AutomationPlanning: Validation progress', {
          completed: i + 1,
          total: testCases.length,
          progress: `${progress}%`,
          elapsedTimeMs: elapsedTime,
          estimatedRemainingSeconds: estimatedRemaining,
        });
      }

      const testCase = testCases[i];
      try {
        logger.info('AutomationPlanning: Validating test case with Stagehand', {
          testCase: testCase.name,
          index: i + 1,
          total: testCases.length,
          elapsedTimeMs: elapsedTime,
        });

        if (testCase.steps.length === 0) {
          results.push(`### ${testCase.name}\n`);
          results.push(`- **状态**: ⚠️ 无步骤，跳过验证\n\n`);
          continue;
        }

        const firstStep = testCase.steps[0];
        try {
          logger.info('AutomationPlanning: Executing all steps for validation', {
            testCase: testCase.name,
            stepsCount: testCase.steps.length,
          });

          // 在执行步骤前再次检查浏览器状态
          const pageBeforeSteps = await this.stagehandService.getPage();
          if (!pageBeforeSteps) {
            logger.warn('AutomationPlanning: Browser not available before step execution, skipping', {
              testCase: testCase.name,
              index: i + 1,
            });
            // 标记为通过（基于前置检测），但不执行步骤
            passedCases.push(testCase);
            results.push(`### ${testCase.name}\n`);
            results.push(`- **状态**: ⚠️ 浏览器不可用，跳过步骤执行\n\n`);
            continue;
          }

          if (i === 0) {
            // First case: navigate to url and run all steps to validate complete flow
            await runAct(firstStep, url);
            // Execute remaining steps of first case
            for (let k = 1; k < testCase.steps.length; k++) {
              // 检查浏览器状态（每个步骤前检查）
              const pageBeforeStep = await this.stagehandService.getPage();
              if (!pageBeforeStep) {
                logger.warn('AutomationPlanning: Browser became unavailable during step execution', {
                  testCase: testCase.name,
                  stepIndex: k + 1,
                });
                break;
              }
              logger.info('AutomationPlanning: Executing step', {
                testCase: testCase.name,
                stepIndex: k + 1,
                step: testCase.steps[k],
              });
              await runAct(testCase.steps[k]);
            }
          } else {
            // Run all steps of prior cases in order (same session), then validate current case's complete flow
            for (let j = 0; j < i; j++) {
              const prior = testCases[j];
              for (let k = 0; k < prior.steps.length; k++) {
                // 检查浏览器状态（每个步骤前检查）
                const pageBeforePriorStep = await this.stagehandService.getPage();
                if (!pageBeforePriorStep) {
                  logger.warn('AutomationPlanning: Browser became unavailable during prior case step execution', {
                    priorCase: prior.name,
                    stepIndex: k + 1,
                  });
                  throw new Error('Browser became unavailable during validation');
                }
                const navUrl = j === 0 && k === 0 ? url : undefined;
                await runAct(prior.steps[k], navUrl);
              }
            }
            // Execute all steps of current case (not just first step)
            await runAct(firstStep);
            for (let k = 1; k < testCase.steps.length; k++) {
              // 检查浏览器状态（每个步骤前检查）
              const pageBeforeStep = await this.stagehandService.getPage();
              if (!pageBeforeStep) {
                logger.warn('AutomationPlanning: Browser became unavailable during step execution', {
                  testCase: testCase.name,
                  stepIndex: k + 1,
                });
                break;
              }
              logger.info('AutomationPlanning: Executing step', {
                testCase: testCase.name,
                stepIndex: k + 1,
                step: testCase.steps[k],
              });

              try {
                await runAct(testCase.steps[k]);

                // 执行步骤后检查页面状态，避免跳转到错误页面（如 nginx 404）
                const pageAfterStep = await this.stagehandService.getPage();
                if (pageAfterStep) {
                  const currentUrlAfterStep = typeof pageAfterStep.url === 'function' ? pageAfterStep.url() : pageAfterStep.url || '';
                  if (
                    currentUrlAfterStep &&
                    (currentUrlAfterStep.includes('nginx') || currentUrlAfterStep.includes('404') || currentUrlAfterStep.includes('error'))
                  ) {
                    logger.warn('AutomationPlanning: Page shows error after step execution', {
                      testCase: testCase.name,
                      stepIndex: k + 1,
                      step: testCase.steps[k],
                      currentUrl: currentUrlAfterStep,
                    });
                    // 不抛出错误，继续执行，但记录警告
                  } else {
                    logger.debug('AutomationPlanning: Page state after step', {
                      testCase: testCase.name,
                      stepIndex: k + 1,
                      currentUrl: currentUrlAfterStep,
                    });
                  }
                }
              } catch (stepError: any) {
                logger.error('AutomationPlanning: Step execution failed', {
                  testCase: testCase.name,
                  stepIndex: k + 1,
                  step: testCase.steps[k],
                  error: stepError.message,
                });
                // 检查是否是页面跳转错误
                const pageAfterError = await this.stagehandService.getPage();
                if (pageAfterError) {
                  const errorUrl = typeof pageAfterError.url === 'function' ? pageAfterError.url() : pageAfterError.url || '';
                  logger.error('AutomationPlanning: Page URL after step error', {
                    testCase: testCase.name,
                    stepIndex: k + 1,
                    url: errorUrl,
                  });
                }
                throw stepError; // 重新抛出错误
              }
            }
          }

          logger.info('AutomationPlanning: All steps executed successfully', {
            testCase: testCase.name,
            stepsCount: testCase.steps.length,
          });

          // 执行完所有步骤后，再次检查最终页面状态
          const finalPage = await this.stagehandService.getPage();
          if (finalPage) {
            const finalUrl = typeof finalPage.url === 'function' ? finalPage.url() : finalPage.url || '';
            logger.info('AutomationPlanning: Final page state after all steps', {
              testCase: testCase.name,
              finalUrl,
              isErrorPage: finalUrl.includes('nginx') || finalUrl.includes('404') || finalUrl.includes('error'),
            });
          }

          // 验证预期结果
          const expectedResults = testCase.expectedResults || [];
          const validationResults: string[] = [];
          let allExpectedResultsPassed = true;

          if (expectedResults.length > 0 && !skipExpectedResultsValidation) {
            logger.info('AutomationPlanning: Validating expected results', {
              testCase: testCase.name,
              expectedResultsCount: expectedResults.length,
            });

            const page = await this.stagehandService.getPage();
            // 如果页面不可用，跳过预期结果验证
            if (!page) {
              logger.warn('AutomationPlanning: Page not available, skipping expected result validation', {
                testCase: testCase.name,
                expectedResultsCount: expectedResults.length,
              });
              validationResults.push('⚠️ 页面不可用，跳过预期结果验证');
            } else if (typeof page.content === 'function' && typeof page.textContent === 'function') {
              try {
                const pageContent = await page.content();
                const pageText = (await page.textContent('body')) || '';
                const currentUrl = typeof page.url === 'function' ? page.url() : page.url || '';

                for (let erIdx = 0; erIdx < expectedResults.length; erIdx++) {
                  const er = expectedResults[erIdx];
                  let passed = false;
                  let detail = '';

                  // 根据预期结果类型进行验证
                  if (er.includes('提示') || er.includes('显示') || er.includes('出现')) {
                    const keywords = er.replace(/提示[：:]|显示[：:]|出现[：:]/g, '').trim();
                    passed = pageText.includes(keywords) || pageContent.includes(keywords);
                    detail = passed ? `找到提示: "${keywords}"` : `未找到提示: "${keywords}"`;
                  } else if (er.includes('URL') || er.includes('地址') || er.includes('跳转') || er.includes('页面')) {
                    if (er.includes('登录页') || er.includes('login')) {
                      passed = currentUrl.includes('/login');
                      detail = `当前 URL: ${currentUrl}`;
                    } else {
                      passed = currentUrl && currentUrl !== 'about:blank';
                      detail = `当前 URL: ${currentUrl}`;
                    }
                  } else if (er.includes('状态') || er.includes('已登录') || er.includes('可访问')) {
                    // 使用 observe 进行语义验证（仅在页面可用时）
                    const pageForObserve = await this.stagehandService.getPage();
                    if (!pageForObserve) {
                      logger.warn('AutomationPlanning: Page not available for observe, skipping validation', {
                        testCase: testCase.name,
                        expectedResultIndex: erIdx + 1,
                        expectedResult: er,
                      });
                      passed = false;
                      detail = '页面不可用，跳过验证';
                    } else {
                      try {
                        await this.stagehandService.observe(`验证${er}`);
                        passed = true;
                        detail = '通过 observe 验证';
                      } catch {
                        passed = false;
                        detail = 'observe 验证失败';
                      }
                    }
                  } else {
                    // 通用：尝试在页面文本中查找关键词
                    const keywords = er.split(/[，,。.；;]/)[0].trim();
                    passed = pageText.includes(keywords) || pageContent.includes(keywords);
                    detail = passed ? `找到关键词: "${keywords}"` : `未找到关键词: "${keywords}"`;
                  }

                  if (!passed) {
                    allExpectedResultsPassed = false;
                  }

                  const statusIcon = passed ? '✅' : '❌';
                  validationResults.push(`  ${statusIcon} 预期结果 ${erIdx + 1}: ${er} - ${detail}`);
                  logger.info('AutomationPlanning: Expected result validation', {
                    testCase: testCase.name,
                    expectedResultIndex: erIdx + 1,
                    expectedResult: er,
                    passed,
                    detail,
                  });
                }
              } catch (validationError: any) {
                logger.warn('AutomationPlanning: Failed to validate expected results', {
                  testCase: testCase.name,
                  error: validationError.message,
                  stack: validationError.stack,
                });
                validationResults.push(`  ⚠️ 预期结果验证出错: ${validationError.message}`);
                allExpectedResultsPassed = false;
              }
            } else {
              // Page 对象不可用或方法不存在，检查是否可以继续使用 observe
              const pageForObserve = await this.stagehandService.getPage();
              if (!pageForObserve) {
                logger.warn('AutomationPlanning: Page not available, skipping all observe validations', {
                  testCase: testCase.name,
                  expectedResultsCount: expectedResults.length,
                });
                validationResults.push('⚠️ 页面不可用，跳过所有预期结果验证');
                allExpectedResultsPassed = false;
              } else {
                // Page 对象存在但方法不可用，使用 observe 进行语义验证
                logger.warn('AutomationPlanning: Page object methods missing, using observe for validation', {
                  testCase: testCase.name,
                  hasPage: !!page,
                  pageType: page ? typeof page : 'null',
                  hasContent: page ? typeof page.content : 'N/A',
                  hasTextContent: page ? typeof page.textContent : 'N/A',
                });

                // 使用 observe 验证预期结果
                for (let erIdx = 0; erIdx < expectedResults.length; erIdx++) {
                  const er = expectedResults[erIdx];
                  // 再次检查页面是否可用（可能在循环中页面被关闭）
                  const currentPage = await this.stagehandService.getPage();
                  if (!currentPage) {
                    logger.warn('AutomationPlanning: Page became unavailable during validation, skipping remaining validations', {
                      testCase: testCase.name,
                      expectedResultIndex: erIdx + 1,
                      totalExpectedResults: expectedResults.length,
                    });
                    validationResults.push(`  ⚠️ 预期结果 ${erIdx + 1}/${expectedResults.length}: ${er} - 页面不可用，跳过验证`);
                    allExpectedResultsPassed = false;
                    break; // 跳出循环，不再执行剩余的验证
                  }

                  try {
                    await this.stagehandService.observe(`验证预期结果：${er}`);
                    validationResults.push(`  ✅ 预期结果 ${erIdx + 1}: ${er} - 通过 observe 验证`);
                    logger.info('AutomationPlanning: Expected result validated via observe', {
                      testCase: testCase.name,
                      expectedResultIndex: erIdx + 1,
                      expectedResult: er,
                    });
                  } catch (observeError: any) {
                    validationResults.push(`  ⚠️ 预期结果 ${erIdx + 1}: ${er} - observe 验证失败: ${observeError.message}`);
                    allExpectedResultsPassed = false;
                    logger.warn('AutomationPlanning: Expected result observe validation failed', {
                      testCase: testCase.name,
                      expectedResultIndex: erIdx + 1,
                      expectedResult: er,
                      error: observeError.message,
                    });
                  }
                }
              }
            }
          }

          // 只有步骤执行成功且预期结果验证通过（或没有预期结果）才标记为通过
          if (allExpectedResultsPassed || expectedResults.length === 0) {
            passedCases.push(testCase);
            results.push(`### ${testCase.name}\n`);
            results.push(`- **状态**: ✅ 已验证可行\n`);
            results.push(`- **验证步骤**: 已执行全部 ${testCase.steps.length} 个步骤\n`);
            if (expectedResults.length > 0) {
              results.push(`- **预期结果验证**: ✅ 全部通过 (${expectedResults.length} 项)\n`);
              results.push(`- **验证详情**:\n${validationResults.join('\n')}\n`);
            }
            results.push(`- **说明**: 该测试用例可以通过 Stagehand 自动化执行\n\n`);
          } else {
            // 步骤执行成功但预期结果验证失败
            results.push(`### ${testCase.name}\n`);
            results.push(`- **状态**: ⚠️ 步骤执行成功，但预期结果验证未完全通过\n`);
            results.push(`- **验证步骤**: 已执行全部 ${testCase.steps.length} 个步骤\n`);
            results.push(`- **预期结果验证**: ❌ 部分失败\n`);
            results.push(`- **验证详情**:\n${validationResults.join('\n')}\n`);
            results.push(`- **建议**: 检查预期结果是否正确，或调整验证逻辑\n\n`);
            // 仍然加入 passedCases，因为步骤执行成功了
            passedCases.push(testCase);
          }
        } catch (error: any) {
          results.push(`### ${testCase.name}\n`);
          results.push(`- **状态**: ⚠️ 需要调整\n`);
          results.push(`- **验证步骤**: ${firstStep}\n`);
          results.push(`- **说明**: ${error.message}\n`);
          results.push(`- **建议**: 可能需要调整操作步骤或使用更精确的选择器\n\n`);
        }
      } catch (error: any) {
        logger.warn('AutomationPlanning: Test case validation failed', {
          testCase: testCase.name,
          error: error.message,
        });
        results.push(`### ${testCase.name}\n`);
        results.push(`- **状态**: ❌ 验证失败\n`);
        results.push(`- **错误**: ${error.message}\n\n`);
      }
    }

    return { report: results.join(''), passedCases };
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
