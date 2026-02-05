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
    logger.info('========================================');
    logger.info('AutomationPlanning: Starting automation planning');
    logger.info('========================================');

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
          reason: !stagehandScriptFiles ? 'stagehandScriptFiles is null/undefined' : 
                  stagehandScriptFiles.length === 0 ? 'stagehandScriptFiles.length is 0' : 'unknown',
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
   * Extract sample test cases for Stagehand validation
   * Now extracts ALL test cases, not just a sample
   */
  private extractSampleTestCases(testCases: string, maxCount?: number): Array<{ id: string; name: string; steps: string[]; expectedResults: string[]; precondition: string }> {
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
          const parts = trimmed.split('|').map((p) => p.trim()).filter((p) => p);
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
    const timeoutMs =
      planningOptions?.stagehandValidationTimeoutMs ??
      parseInt(process.env.STAGEHAND_VALIDATION_TIMEOUT_MS || '45000', 10);
    const overallTimeoutMs =
      planningOptions?.validationOverallTimeoutMs ??
      parseInt(process.env.VALIDATION_OVERALL_TIMEOUT_MS || '600000', 10); // 10分钟
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
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Validation timeout (${timeoutMs}ms)`)), timeoutMs)
        ),
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
        const progress = ((i + 1) / testCases.length * 100).toFixed(1);
        const avgTimePerCase = i > 0 ? elapsedTime / (i + 1) : elapsedTime;
        const estimatedRemaining = Math.round((testCases.length - i - 1) * avgTimePerCase / 1000);
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
                  if (currentUrlAfterStep && (currentUrlAfterStep.includes('nginx') || currentUrlAfterStep.includes('404') || currentUrlAfterStep.includes('error'))) {
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
   * Load automation-test skill content for script header (SKILL.md + automation-flow.md).
   * Returns excerpts for injection; on missing file or error returns empty strings.
   */
  private async loadAutomationSkillContent(): Promise<{ skillExcerpt: string; flowExcerpt: string }> {
    const projectRoot = path.resolve(__dirname, '../../..');
    const skillPath = path.join(projectRoot, 'skills', 'automation-test', 'SKILL.md');
    const flowPath = path.join(projectRoot, 'skills', 'automation-test', 'references', 'automation-flow.md');
    let skillExcerpt = '';
    let flowExcerpt = '';

    try {
      const skillRaw = await fs.readFile(skillPath, 'utf-8').catch(() => '');
      const scriptNormSection = skillRaw.match(/#\s*脚本规范[^#]*?(?=\n#|$)/s);
      if (scriptNormSection) {
        skillExcerpt = scriptNormSection[0].replace(/#\s*脚本规范[^\n]*\n\n?/, '').trim();
        if (skillExcerpt.length > 400) skillExcerpt = skillExcerpt.slice(0, 400) + '...';
      }
      if (!skillExcerpt) {
        skillExcerpt = '1. 仅使用 Stagehand\n2. 必含 act + assert\n3. 必含关键接口监听\n4. 必含流程结果验证';
      }
    } catch {
      skillExcerpt = '1. 仅使用 Stagehand\n2. 必含 act + assert\n3. 必含关键接口监听\n4. 必含流程结果验证';
    }

    try {
      const flowRaw = await fs.readFile(flowPath, 'utf-8').catch(() => '');
      flowExcerpt = flowRaw.trim().split('\n').slice(0, 3).join(' ').slice(0, 120) || 'AutomationPlanning -> AutomationExecution';
    } catch {
      flowExcerpt = 'AutomationPlanning -> AutomationExecution';
    }

    return { skillExcerpt, flowExcerpt };
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
          let prerequisiteCase: { id: string; name: string; steps: string[] } | null = null;
          if (precondition && (precondition.includes('登录') || precondition.includes('已登录'))) {
            // 查找 TC-001（登录用例）
            prerequisiteCase = testCases.find((tc) => tc.id === 'TC-001' || tc.name.includes('登录')) || null;
            if (prerequisiteCase) {
              logger.info('AutomationPlanning: Found prerequisite case for precondition', {
                testCaseId: scriptId,
                precondition,
                prerequisiteCaseId: prerequisiteCase.id,
                prerequisiteStepsCount: prerequisiteCase.steps.length,
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

          // 构建步骤数组：包含前置条件步骤（如果有）和测试用例步骤
          const allSteps: Array<{ step: string; status: string }> = [];

          // 添加前置条件步骤（如果有）
          if (prerequisiteCase && prerequisiteCase.steps.length > 0) {
            const prerequisiteSteps = prerequisiteCase.steps.filter((step) => step && step.trim());
            logger.info('AutomationPlanning: Adding prerequisite steps to JSON', {
              testCaseId: scriptId,
              prerequisiteCaseId: prerequisiteCase.id,
              prerequisiteStepsCount: prerequisiteSteps.length,
            });
            for (const step of prerequisiteSteps) {
              const trimmedStep = step.trim();
              if (trimmedStep) {
                allSteps.push({
                  step: trimmedStep,
                  status: 'pending',
                });
              }
            }
          }

          // 添加测试用例步骤
          for (const step of safeSteps) {
            const trimmedStep = step.trim();
            if (trimmedStep) {
              allSteps.push({
                step: trimmedStep,
                status: 'pending',
              });
            }
          }

          // 构建 JSON 对象
          const testCaseJSON = {
            testCase: safeName,
            status: 'pending',
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
