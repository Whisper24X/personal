/**
 * WriteCode Action
 * Generates source code from design document
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { CODE_SYSTEM_PROMPT, buildCodePrompt, parseCodeFiles } from '../prompts/code';
import { logger } from '../utils';

export class WriteCode extends BaseAction {
  constructor() {
    super('WriteCode', 'Generate source code from design document');
  }

  async run(design: string): Promise<IActionOutput> {
    logger.info('WriteCode: Starting code generation');
    
    try {
      // Build the prompt
      const prompt = buildCodePrompt(design);
      
      // Call LLM with system message and prompt
      const codeOutput = await this.aask(prompt, [CODE_SYSTEM_PROMPT]);
      
      // Parse the output into separate files
      const files = parseCodeFiles(codeOutput);
      
      logger.info('WriteCode: Code generation completed', {
        filesGenerated: files.length,
        totalLength: codeOutput.length,
      });
      
      // Create a summary of generated files
      const summary = files.map((f) => `- ${f.path}`).join('\n');
      
      return {
        content: `# Generated Code\n\n## Files Created:\n${summary}\n\n## Full Code:\n\n${codeOutput}`,
        data: {
          type: 'code',
          files: files,
          filesCount: files.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('WriteCode: Failed to generate code', error);
      throw error;
    }
  }
}

export default WriteCode;

