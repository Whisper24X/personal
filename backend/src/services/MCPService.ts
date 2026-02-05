/**
 * MCP Service
 * Provides script validation, error analysis, and auto-fix capabilities using LLM
 */

import { logger } from '../utils';
import { Context } from '../core/context/Context';

export interface ScriptIssue {
  type: 'syntax' | 'logic' | 'runtime' | 'best_practice';
  severity: 'error' | 'warning';
  line?: number;
  message: string;
  suggestion?: string;
}

export interface ScriptValidationResult {
  hasIssues: boolean;
  issues: ScriptIssue[];
  isValid: boolean;
}

export interface ErrorAnalysis {
  canAutoFix: boolean;
  issues: ScriptIssue[];
  rootCause?: string;
  fixConfidence: number; // 0-1
}

export interface ScriptImprovement {
  type: 'optimization' | 'readability' | 'error_handling';
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export class MCPService {
  private context?: Context;

  constructor(context?: Context) {
    this.context = context;
  }

  /**
   * Set context for LLM access
   */
  setContext(context: Context): void {
    this.context = context;
  }

  /**
   * Get LLM instance from context
   */
  private getLLM(): any {
    if (!this.context || !this.context.llm) {
      throw new Error('MCPService: LLM not available. Context must be set.');
    }
    return this.context.llm;
  }

  /**
   * Validate script syntax and logic
   */
  async validateScript(script: string): Promise<ScriptValidationResult> {
    logger.info('MCPService: Validating script', {
      scriptLength: script.length,
    });

    try {
      const llm = this.getLLM();
      const prompt = this.buildValidationPrompt(script);
      const systemPrompt = this.getValidationSystemPrompt();

      const response = await llm.aask(prompt, [systemPrompt]);

      // Parse LLM response to extract issues
      const issues = this.parseValidationResponse(response);
      const hasIssues = issues.length > 0;
      const isValid = !hasIssues || issues.every((issue) => issue.severity === 'warning');

      logger.info('MCPService: Script validation completed', {
        hasIssues,
        isValid,
        issuesCount: issues.length,
      });

      return {
        hasIssues,
        issues,
        isValid,
      };
    } catch (error: any) {
      logger.error('MCPService: Script validation failed', {
        error: error.message,
      });
      // Return safe default - assume valid if validation fails
      return {
        hasIssues: false,
        issues: [],
        isValid: true,
      };
    }
  }

  /**
   * Fix script issues
   */
  async fixScript(script: string, issues: ScriptIssue[]): Promise<string> {
    logger.info('MCPService: Fixing script', {
      scriptLength: script.length,
      issuesCount: issues.length,
    });

    try {
      const llm = this.getLLM();
      const prompt = this.buildFixPrompt(script, issues);
      const systemPrompt = this.getFixSystemPrompt();

      const fixedScript = await llm.aask(prompt, [systemPrompt]);

      // Extract code from markdown code blocks if present
      const cleanedScript = this.extractCodeFromResponse(fixedScript);

      logger.info('MCPService: Script fixed', {
        originalLength: script.length,
        fixedLength: cleanedScript.length,
        issuesFixed: issues.length,
      });

      return cleanedScript;
    } catch (error: any) {
      logger.error('MCPService: Script fix failed', {
        error: error.message,
      });
      // Return original script if fix fails
      return script;
    }
  }

  /**
   * Analyze execution error
   */
  async analyzeError(error: Error | string, script: string, logs: string[] = []): Promise<ErrorAnalysis> {
    logger.info('MCPService: Analyzing error', {
      errorMessage: typeof error === 'string' ? error : error.message,
      scriptLength: script.length,
      logsCount: logs.length,
    });

    try {
      const llm = this.getLLM();
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'string' ? '' : (error as any).stack || '';
      const prompt = this.buildErrorAnalysisPrompt(script, errorMessage, errorStack, logs);
      const systemPrompt = this.getErrorAnalysisSystemPrompt();

      const response = await llm.aask(prompt, [systemPrompt]);

      // Parse LLM response
      const analysis = this.parseErrorAnalysisResponse(response);

      logger.info('MCPService: Error analysis completed', {
        canAutoFix: analysis.canAutoFix,
        fixConfidence: analysis.fixConfidence,
        issuesCount: analysis.issues.length,
      });

      return analysis;
    } catch (error: any) {
      logger.error('MCPService: Error analysis failed', {
        error: error.message,
      });
      // Return safe default - cannot auto-fix if analysis fails
      return {
        canAutoFix: false,
        issues: [],
        fixConfidence: 0,
      };
    }
  }

  /**
   * Suggest script improvements
   */
  async suggestImprovements(script: string): Promise<ScriptImprovement[]> {
    logger.info('MCPService: Suggesting improvements', {
      scriptLength: script.length,
    });

    try {
      const llm = this.getLLM();
      const prompt = this.buildImprovementPrompt(script);
      const systemPrompt = this.getImprovementSystemPrompt();

      const response = await llm.aask(prompt, [systemPrompt]);

      const improvements = this.parseImprovementResponse(response);

      logger.info('MCPService: Improvements suggested', {
        improvementsCount: improvements.length,
      });

      return improvements;
    } catch (error: any) {
      logger.error('MCPService: Improvement suggestion failed', {
        error: error.message,
      });
      return [];
    }
  }

  // ========== Prompt Builders ==========

  private buildValidationPrompt(script: string): string {
    return `请分析以下 TypeScript 自动化测试脚本，检查语法错误、逻辑错误和最佳实践问题。

脚本内容：
\`\`\`typescript
${script}
\`\`\`

请以 JSON 格式返回分析结果：
{
  "issues": [
    {
      "type": "syntax|logic|runtime|best_practice",
      "severity": "error|warning",
      "line": 行号（可选）,
      "message": "问题描述",
      "suggestion": "修复建议（可选）"
    }
  ]
}

如果没有问题，返回 {"issues": []}。`;
  }

  private buildFixPrompt(script: string, issues: ScriptIssue[]): string {
    const issuesText = issues
      .map((issue, idx) => `${idx + 1}. [${issue.type}] ${issue.severity}: ${issue.message}${issue.suggestion ? ` (建议: ${issue.suggestion})` : ''}`)
      .join('\n');

    return `请修复以下 TypeScript 自动化测试脚本中的问题。

原始脚本：
\`\`\`typescript
${script}
\`\`\`

需要修复的问题：
${issuesText}

请返回修复后的完整脚本代码（只返回代码，不要包含 markdown 代码块标记外的其他内容）。`;
  }

  private buildErrorAnalysisPrompt(script: string, errorMessage: string, errorStack: string, logs: string[]): string {
    const logsText = logs.length > 0 ? logs.slice(-20).join('\n') : '无日志';

    return `请分析以下自动化测试脚本的执行错误。

脚本内容：
\`\`\`typescript
${script}
\`\`\`

错误信息：
${errorMessage}

错误堆栈：
${errorStack || '无堆栈信息'}

执行日志（最后20行）：
${logsText}

请以 JSON 格式返回分析结果：
{
  "canAutoFix": true|false,
  "rootCause": "根本原因分析",
  "fixConfidence": 0.0-1.0,
  "issues": [
    {
      "type": "syntax|logic|runtime|best_practice",
      "severity": "error|warning",
      "message": "问题描述",
      "suggestion": "修复建议"
    }
  ]
}`;
  }

  private buildImprovementPrompt(script: string): string {
    return `请分析以下 TypeScript 自动化测试脚本，提供改进建议。

脚本内容：
\`\`\`typescript
${script}
\`\`\`

请以 JSON 格式返回改进建议：
{
  "improvements": [
    {
      "type": "optimization|readability|error_handling",
      "description": "改进描述",
      "priority": "high|medium|low"
    }
  ]
}

如果没有改进建议，返回 {"improvements": []}。`;
  }

  // ========== System Prompts ==========

  private getValidationSystemPrompt(): string {
    return `你是一个专业的 TypeScript 代码审查专家，专门审查自动化测试脚本。
你的任务是：
1. 检查语法错误
2. 检查逻辑错误（如未定义的变量、类型错误等）
3. 检查运行时错误（如空指针、未处理的异常等）
4. 检查最佳实践（如错误处理、资源清理等）

请仔细分析代码，只报告真实存在的问题。`;
  }

  private getFixSystemPrompt(): string {
    return `你是一个专业的 TypeScript 代码修复专家，专门修复自动化测试脚本。
你的任务是：
1. 修复所有报告的问题
2. 保持代码的功能不变
3. 保持代码风格一致
4. 确保修复后的代码可以正常执行

请只返回修复后的代码，不要添加额外的解释。`;
  }

  private getErrorAnalysisSystemPrompt(): string {
    return `你是一个专业的错误分析专家，专门分析自动化测试脚本的执行错误。
你的任务是：
1. 分析错误的根本原因
2. 判断是否可以自动修复
3. 评估修复的置信度
4. 提供具体的修复建议

请仔细分析错误信息和代码，给出准确的分析结果。`;
  }

  private getImprovementSystemPrompt(): string {
    return `你是一个专业的代码改进专家，专门改进自动化测试脚本。
你的任务是：
1. 识别可以优化的地方
2. 识别可以提高可读性的地方
3. 识别可以改进错误处理的地方

请提供有价值的改进建议，按优先级排序。`;
  }

  // ========== Response Parsers ==========

  private parseValidationResponse(response: string): ScriptIssue[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const issues: ScriptIssue[] = (parsed.issues || []).map((issue: any) => ({
        type: issue.type || 'logic',
        severity: issue.severity || 'warning',
        line: issue.line,
        message: issue.message || '',
        suggestion: issue.suggestion,
      }));

      return issues;
    } catch (error: any) {
      logger.warn('MCPService: Failed to parse validation response', {
        error: error.message,
      });
      return [];
    }
  }

  private parseErrorAnalysisResponse(response: string): ErrorAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          canAutoFix: false,
          issues: [],
          fixConfidence: 0,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const issues: ScriptIssue[] = (parsed.issues || []).map((issue: any) => ({
        type: issue.type || 'runtime',
        severity: issue.severity || 'error',
        message: issue.message || '',
        suggestion: issue.suggestion,
      }));

      return {
        canAutoFix: parsed.canAutoFix === true,
        rootCause: parsed.rootCause,
        fixConfidence: Math.max(0, Math.min(1, parsed.fixConfidence || 0)),
        issues,
      };
    } catch (error: any) {
      logger.warn('MCPService: Failed to parse error analysis response', {
        error: error.message,
      });
      return {
        canAutoFix: false,
        issues: [],
        fixConfidence: 0,
      };
    }
  }

  private parseImprovementResponse(response: string): ScriptImprovement[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const improvements: ScriptImprovement[] = (parsed.improvements || []).map((imp: any) => ({
        type: imp.type || 'optimization',
        description: imp.description || '',
        priority: imp.priority || 'medium',
      }));

      return improvements;
    } catch (error: any) {
      logger.warn('MCPService: Failed to parse improvement response', {
        error: error.message,
      });
      return [];
    }
  }

  private extractCodeFromResponse(response: string): string {
    // Try to extract code from markdown code blocks
    const codeBlockMatch = response.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If no code block, return the response as-is (trimmed)
    return response.trim();
  }
}
