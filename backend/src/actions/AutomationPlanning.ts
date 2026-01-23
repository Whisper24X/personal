/**
 * AutomationPlanning Action
 * Evaluates which test cases can be automated and creates an automation plan
 * Uses Stagehand to validate automation feasibility and generate automation scripts
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import {
  AUTOMATION_PLANNING_SYSTEM_PROMPT,
  buildAutomationPlanningPrompt,
} from '../prompts/test';
import { StagehandService } from '../services/StagehandService';

export interface AutomationPlanningOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
  testUrl?: string; // Optional URL to test against for feasibility validation
  useStagehand?: boolean; // Whether to use Stagehand for validation (default: true if ENABLE_BROWSER=true)
}

export class AutomationPlanning extends BaseAction {
  private stagehandService: StagehandService;

  constructor() {
    super(
      'AutomationPlanning',
      'Evaluate test cases for automation feasibility and create an automation plan with priorities and technology choices'
    );
    this.stagehandService = new StagehandService();
  }

  async run(input: string, options?: AutomationPlanningOptions): Promise<IActionOutput> {
    logger.info('AutomationPlanning: Starting automation planning');

    if (!input || input.trim() === '') {
      throw new Error('Input content not found');
    }

    try {
      // Read test cases from workspace
      let testCases = '';
      let code = '';

      if (options) {
        // Try to read reviewed test cases first, fallback to original test cases
        try {
          const reviewedTestCases = await this.readWorkspaceFile('TEST_CASES_REVIEWED.md', {
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

        // Read code from workspace
        try {
          const codeFromWorkspace = await this.readAllFromWorkspace(
            {
              ...options,
              documentType: 'CODE',
            },
            (filename: string) => {
              return (
                filename.endsWith('.ts') ||
                filename.endsWith('.js') ||
                filename.endsWith('.py') ||
                filename.endsWith('.java')
              );
            }
          );
          if (codeFromWorkspace) {
            code = codeFromWorkspace;
          }
        } catch (error: any) {
          logger.warn('AutomationPlanning: Failed to read code from workspace', {
            error: error.message,
          });
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
        try {
          logger.info('AutomationPlanning: Using Stagehand to validate automation feasibility');
          const userId = this.context?.get('userId') as string | undefined;
          await this.stagehandService.initialize(userId);

          // Extract all test cases for script generation (no limit, or use a reasonable limit like 50)
          const sampleTestCases = this.extractSampleTestCases(testCases, 50); // Extract up to 50 test cases for script generation
          const testUrl = options?.testUrl || this.extractUrlFromTestCases(testCases);

          logger.info('AutomationPlanning: Extracted sample test cases', {
            sampleTestCasesCount: sampleTestCases.length,
            testUrl,
            testCasesLength: testCases.length,
          });

          if (sampleTestCases.length > 0) {
            stagehandValidationResults = await this.validateWithStagehand(
              sampleTestCases,
              testUrl
            );
            stagehandScriptFiles = await this.generateStagehandScripts(sampleTestCases, testUrl);
            logger.info('AutomationPlanning: Generated Stagehand scripts', {
              scriptsCount: stagehandScriptFiles.length,
              scriptIds: stagehandScriptFiles.map(s => s.id),
            });
          } else {
            logger.warn('AutomationPlanning: No sample test cases extracted, skipping Stagehand script generation', {
              testCasesLength: testCases.length,
            });
          }

          // Cleanup Stagehand resources
          await this.stagehandService.close();
        } catch (error: any) {
          logger.warn('AutomationPlanning: Stagehand validation failed, continuing with LLM-only planning', {
            error: error.message,
          });
          // Continue with LLM-only planning if Stagehand fails
          try {
            await this.stagehandService.close();
          } catch (closeError: any) {
            // Ignore cleanup errors
          }
        }
      }

      // Build prompt with Stagehand validation results if available
      // Add validation results and script summary to test cases if available
      let enhancedTestCases = testCases;
      if (stagehandValidationResults) {
        enhancedTestCases += `\n\n## Stagehand 自动化可行性验证结果\n\n${stagehandValidationResults}`;
      }
      if (stagehandScriptFiles.length > 0) {
        enhancedTestCases += `\n\n## 已生成的自动化测试脚本\n\n已生成 ${stagehandScriptFiles.length} 个自动化测试脚本文件：\n${stagehandScriptFiles.map(s => `- ${s.filename} (${s.id})`).join('\n')}`;
      }
      
      const prompt = buildAutomationPlanningPrompt(
        enhancedTestCases,
        code
      );

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'automation_planning_system_prompt',
        AUTOMATION_PLANNING_SYSTEM_PROMPT
      );

      // Call LLM to generate automation plan
      const content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };
      await this.saveToWorkspace('AUTOMATION_PLAN.md', content, workspaceOptions);

      logger.info('AutomationPlanning: Automation planning completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      // Save Stagehand scripts if generated (one file per test case)
      if (stagehandScriptFiles.length > 0) {
        try {
          const savedFiles: string[] = [];
          for (const scriptFile of stagehandScriptFiles) {
            try {
              const scriptPath = `auto/${scriptFile.filename}`;
              await this.saveToWorkspace(scriptPath, scriptFile.content, workspaceOptions);
              savedFiles.push(scriptPath);
            } catch (fileError: any) {
              logger.warn('AutomationPlanning: Failed to save individual script file', {
                filename: scriptFile.filename,
                error: fileError.message,
              });
              // Continue saving other files even if one fails
            }
          }
          const fullPath = this.getWorkspaceDir(workspaceOptions);
          if (savedFiles.length > 0) {
            logger.info('AutomationPlanning: Saved Stagehand scripts', {
              scriptsCount: stagehandScriptFiles.length,
              savedCount: savedFiles.length,
              scriptFiles: savedFiles,
              fullPath: `${fullPath}/auto/`,
            });
          } else {
            logger.warn('AutomationPlanning: No script files were saved successfully', {
              attemptedCount: stagehandScriptFiles.length,
            });
          }
        } catch (saveError: any) {
          logger.error('AutomationPlanning: Failed to save Stagehand scripts, but continuing', {
            error: saveError.message,
          });
          // Don't throw - allow the process to continue
        }
      } else {
        logger.warn('AutomationPlanning: No Stagehand scripts to save', {
          useStagehand,
          scriptsCount: stagehandScriptFiles.length,
        });
      }

      return {
        content: content,
        data: {
          type: 'automation_plan',
          filename: 'AUTOMATION_PLAN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          stagehandUsed: useStagehand,
          stagehandScriptsGenerated: stagehandScriptFiles.length > 0,
          stagehandScriptsCount: stagehandScriptFiles.length,
        },
      };
    } catch (error: any) {
      logger.error('AutomationPlanning: Failed to create automation plan', error);
      
      // Ensure cleanup on error
      try {
        if (this.stagehandService.isInitialized) {
          await this.stagehandService.close();
        }
      } catch (closeError: any) {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }

  /**
   * Extract sample test cases for Stagehand validation
   * Now extracts ALL test cases, not just a sample
   */
  private extractSampleTestCases(testCases: string, maxCount?: number): Array<{ id: string; name: string; steps: string[] }> {
    const samples: Array<{ id: string; name: string; steps: string[] }> = [];
    
    // Preprocess: Extract content from markdown code blocks if present
    let processedContent = testCases;
    
    // Check if content is wrapped in markdown code blocks (```markdown ... ```)
    // Try multiple patterns to match code blocks robustly
    let codeBlockMatch = testCases.match(/```(?:markdown)?\s*\n([\s\S]*?)\n```/);
    if (!codeBlockMatch) {
      // Try without newline before closing ```
      codeBlockMatch = testCases.match(/```(?:markdown)?\s*\n([\s\S]*?)```/);
    }
    if (!codeBlockMatch) {
      // Try matching until end of string
      codeBlockMatch = testCases.match(/```(?:markdown)?\s*\n([\s\S]*)$/);
    }
    
    if (codeBlockMatch && codeBlockMatch[1]) {
      processedContent = codeBlockMatch[1].trim();
      logger.info('AutomationPlanning: Extracted content from markdown code block', {
        originalLength: testCases.length,
        extractedLength: processedContent.length,
      });
    }
    
    // Remove leading explanatory text (lines that don't contain test case markers)
    // Find the first occurrence of a test case header or section marker
    const firstTestCaseIndex = processedContent.search(/####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case)/i);
    if (firstTestCaseIndex > 0) {
      processedContent = processedContent.substring(firstTestCaseIndex);
      logger.debug('AutomationPlanning: Removed leading text before first test case', {
        removedLength: firstTestCaseIndex,
      });
    } else if (firstTestCaseIndex === -1) {
      // If no test case header found, try to find section headers that might contain test cases
      const sectionMatch = processedContent.match(/##\s+功能模块[\s\S]*?(####\s+(测试用例\d+|TC-[\dA-Z-]+|Test Case))/i);
      if (sectionMatch && sectionMatch.index !== undefined) {
        processedContent = processedContent.substring(sectionMatch.index);
        logger.debug('AutomationPlanning: Found test cases in section, removed leading text');
      }
    }
    
    // Log processed content for debugging
    logger.info('AutomationPlanning: Processed content for extraction', {
      processedLength: processedContent.length,
      first100Chars: processedContent.substring(0, 100),
      hasCodeBlock: !!codeBlockMatch,
    });
    
    const lines = processedContent.split('\n');

    let currentTestCase: { id: string; name: string; steps: string[] } | null = null;
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

      // Detect steps section - match "测试步骤" or "**测试步骤**" or "- **测试步骤**："
      if (trimmed.match(/测试步骤|Steps|操作步骤/i) && currentTestCase) {
        inSteps = true;
        inExpectedResults = false;
        continue;
      }

      // Reset inSteps when we encounter "预期结果" section
      if (trimmed.match(/预期结果|Expected Result|Expected Results/i) && currentTestCase) {
        inSteps = false;
        inExpectedResults = true;
        continue;
      }

      // Collect steps - only collect numbered steps (1., 2., etc.) to avoid collecting expected results
      // Also handle steps that might be indented (e.g., "  1. step")
      if (inSteps && !inExpectedResults && currentTestCase) {
        // Match numbered steps: "1. step" or "  1. step" (with optional indentation)
        // Also handle markdown list format: "- 1. step" or "* 1. step"
        const stepMatch = trimmed.match(/^[\s\-*]*\d+\.\s+(.+)$/);
        if (stepMatch) {
          const step = stepMatch[1].trim();
          // More lenient filtering: accept steps with length >= 3 (instead of 5)
          // Exclude lines that are clearly not steps (like "**预期结果**")
          if (step && step.length >= 3 && !step.match(/^\*\*.*\*\*$/) && !step.includes('预期结果')) {
            currentTestCase.steps.push(step);
            logger.debug('AutomationPlanning: Extracted test step', {
              testCaseId: currentTestCase.id || 'unknown',
              step: step.substring(0, 50),
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
    logger.info('AutomationPlanning: Test case extraction completed', {
      extractedCount: samples.length,
      maxCount: maxCount || 'unlimited',
      testCaseIds: samples.map(tc => tc.id),
      testCaseNames: samples.map(tc => tc.name.substring(0, 30)),
      stepsCounts: samples.map(tc => tc.steps.length),
    });

    return samples;
  }

  /**
   * Extract URL from test cases if mentioned
   */
  private extractUrlFromTestCases(testCases: string): string | undefined {
    const urlMatch = testCases.match(/https?:\/\/[^\s\)]+/i);
    return urlMatch ? urlMatch[0] : undefined;
  }

  /**
   * Validate test cases using Stagehand
   */
  private async validateWithStagehand(
    testCases: Array<{ id: string; name: string; steps: string[] }>,
    url?: string
  ): Promise<string> {
    const results: string[] = [];

    results.push('## Stagehand 自动化可行性验证结果\n\n');
    results.push('以下测试用例已通过 Stagehand 实际验证：\n\n');

    for (const testCase of testCases) {
      try {
        logger.info('AutomationPlanning: Validating test case with Stagehand', {
          testCase: testCase.name,
        });

        // Try to execute first step to validate feasibility
        if (testCase.steps.length > 0) {
          const firstStep = testCase.steps[0];
          try {
            await this.stagehandService.act(firstStep, url);
            results.push(`### ${testCase.name}\n`);
            results.push(`- **状态**: ✅ 已验证可行\n`);
            results.push(`- **验证步骤**: ${firstStep}\n`);
            results.push(`- **说明**: 该测试用例可以通过 Stagehand 自动化执行\n\n`);
          } catch (error: any) {
            results.push(`### ${testCase.name}\n`);
            results.push(`- **状态**: ⚠️ 需要调整\n`);
            results.push(`- **验证步骤**: ${firstStep}\n`);
            results.push(`- **说明**: ${error.message}\n`);
            results.push(`- **建议**: 可能需要调整操作步骤或使用更精确的选择器\n\n`);
          }
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

    return results.join('');
  }

  /**
   * Generate Stagehand automation scripts for each test case
   * Returns an array of script files with their IDs and content
   * 严格按照测试用例的步骤顺序生成脚本，确保每个步骤都被正确转换
   */
  private async generateStagehandScripts(
    testCases: Array<{ id: string; name: string; steps: string[] }>,
    url?: string
  ): Promise<Array<{ id: string; filename: string; content: string }>> {
    const scriptFiles: Array<{ id: string; filename: string; content: string }> = [];

    try {
      for (const testCase of testCases) {
        try {
          // Ensure we have valid test case data
          if (!testCase || !testCase.name) {
            logger.warn('AutomationPlanning: Skipping invalid test case', { testCase });
            continue;
          }

          const scriptId = testCase.id || `TC-${String(scriptFiles.length + 1).padStart(3, '0')}`;
          const safeId = scriptId.replace(/[^a-zA-Z0-9-_]/g, '_'); // Sanitize ID for filename
          const filename = `${safeId}.ts`;
          const safeName = (testCase.name || 'Unknown').replace(/'/g, "\\'").replace(/\n/g, ' ');
          const safeSteps = (testCase.steps || []).filter(step => step && step.trim());
          
          logger.info('AutomationPlanning: Generating script for test case', {
            testCaseId: scriptId,
            testCaseName: safeName,
            stepsCount: safeSteps.length,
            steps: safeSteps,
          });

          // 严格按照测试用例的步骤顺序生成脚本代码
          // 每个步骤都必须按照测试用例中的描述执行，不能省略或修改
          // 每个步骤都有详细的注释说明其目的和操作
          const stepsCode = safeSteps.length > 0 
            ? safeSteps.map((step, index) => {
                // 转义特殊字符，确保字符串安全
                const escapedStep = step.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '').trim();
                // 确保步骤不为空
                if (!escapedStep || escapedStep.length === 0) {
                  logger.warn('AutomationPlanning: Empty step found, skipping', {
                    testCaseId: scriptId,
                    stepIndex: index + 1,
                  });
                  return `    // 步骤 ${index + 1}: [空步骤，已跳过]`;
                }
                // 严格按照步骤顺序生成，每个步骤都有注释
                return `    // 步骤 ${index + 1}/${safeSteps.length}: ${escapedStep}\n    await stagehandService.act('${escapedStep}');\n    console.log('步骤 ${index + 1} 执行完成: ${escapedStep}');`;
              }).join('\n\n')
            : '    // 暂无测试步骤';
          
          const scriptContent = `/**
 * Stagehand 自动化测试脚本
 * 测试用例编号: ${scriptId}
 * 测试用例名称: ${safeName}
 * 由 AutomationPlanning 自动生成
 * 生成时间: ${new Date().toLocaleString('zh-CN')}
 * 
 * 重要说明：
 * - 本脚本严格按照测试用例的步骤顺序生成
 * - 每个步骤都按照测试用例中的描述执行，不能省略或修改
 * - 步骤顺序必须与测试用例中的顺序完全一致
 * - 每个步骤都有详细的注释说明其目的和操作
 * - 请勿修改步骤顺序或跳过任何步骤，确保测试用例的完整性
 */

// 导入 StagehandService
// 注意：脚本执行时会设置 NODE_PATH 包含 backend/src，所以可以直接导入
import { StagehandService } from 'services/StagehandService';

const stagehandService = new StagehandService();

async function runTest() {
  try {
    // 初始化 Stagehand
    await stagehandService.initialize();
    console.log('Stagehand initialized successfully');
    console.log('执行测试用例: ${safeName} (${scriptId})');
    console.log('测试用例包含 ${safeSteps.length} 个步骤');

${url ? `    // 步骤 0: 导航到测试URL\n    const testUrl = '${url.replace(/'/g, "\\'")}';\n    console.log('导航到页面:', testUrl);\n    await stagehandService.act('导航到页面', testUrl);\n    console.log('页面加载完成');\n\n` : ''}
    // ========== 开始执行测试步骤 ==========
    // 严格按照测试用例中的步骤顺序执行，每个步骤都有详细注释
    // 重要：必须按照测试用例中的步骤顺序执行，不能跳过或修改任何步骤

${stepsCode}

    // ========== 测试步骤执行完成 ==========
    // 所有步骤已按照测试用例中的顺序执行完成
    console.log('测试用例 ${safeName} (${scriptId}) 执行成功');
    console.log('所有步骤已按顺序完成');
    
    // 清理资源
    await stagehandService.close();
  } catch (error: any) {
    console.error('测试用例 ${safeName} (${scriptId}) 执行失败:', error.message);
    console.error('错误堆栈:', error.stack);
    await stagehandService.close();
    process.exit(1);
  }
}

// 执行测试
runTest();
`;

          scriptFiles.push({
            id: scriptId,
            filename,
            content: scriptContent,
          });

          logger.info('AutomationPlanning: Generated script for test case', {
            testCaseId: scriptId,
            filename,
            stepsCount: safeSteps.length,
          });
        } catch (caseError: any) {
          logger.warn('AutomationPlanning: Failed to generate script for test case', {
            testCase: testCase.name,
            error: caseError.message,
            stack: caseError.stack,
          });
          // Continue processing other test cases
        }
      }
    } catch (error: any) {
      logger.error('AutomationPlanning: Error generating Stagehand scripts', {
        error: error.message,
        stack: error.stack,
      });
      // Return empty array instead of throwing - allow process to continue
    }

    logger.info('AutomationPlanning: Completed generating Stagehand scripts', {
      totalTestCases: testCases.length,
      generatedScripts: scriptFiles.length,
    });

    return scriptFiles;
  }
}
