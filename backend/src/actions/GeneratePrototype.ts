/**
 * GeneratePrototype Action
 * Generates high-fidelity HTML prototype from PRD
 * 
 * 工作流程：
 * 1) 从workspace读取PRD.md文件
 * 2) 使用LLM生成HTML原型代码（单一HTML文件，所有代码内联）
 * 3) 保存原型文件到workspace的docs/prototype/目录
 * 4) 返回原型文件信息和预览URL
 * 
 * 重要：只生成一个index.html文件，所有CSS和JavaScript代码都内联在这个文件中
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PROTOTYPE_SYSTEM_PROMPT,
  buildPrototypePrompt,
} from '../prompts/prototype';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentWriteHandler,
  DOCUMENT_CONFIGS,
  WriteConfig,
} from '../utils/document';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GeneratePrototypeOptions extends WorkspaceOptions {
  prdContent?: string; // 可选：直接传入PRD内容，否则从workspace读取
}

export class GeneratePrototype extends BaseAction {
  constructor() {
    super('GeneratePrototype', 'Generate high-fidelity HTML prototype from PRD');
  }

  /**
   * 创建 WriteHandler（用于CLI模式）
   */
  private async createWriteHandler(): Promise<DocumentWriteHandler> {
    const systemPrompt = await this.loadSystemPrompt('prototype', 'system_prompt', PROTOTYPE_SYSTEM_PROMPT);

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.PROTOTYPE,
      buildWritePrompt: buildPrototypePrompt,
      systemPrompt,
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(input: string, options?: GeneratePrototypeOptions): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'PROTOTYPE');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('GeneratePrototype: Starting prototype generation', {
      applicationId,
      projectId,
      hasInput: !!input,
      hasPrdContent: !!options?.prdContent,
      isCLIMode,
    });

    try {
      // CLI模式：使用 BaseAction 封装的执行方法
      if (isCLIMode) {
        const handler = await this.getCachedHandler('write', () => this.createWriteHandler());
        
        // 记录 workspaceDir 用于调试
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        logger.info('GeneratePrototype: CLI mode - workspaceDir', {
          workspaceDir,
          documentType: workspaceOptions.documentType,
        });
        
        const result = await this.executeWriteHandler(handler, '', workspaceOptions, {
          type: 'prototype',
          filename: 'index.html',
        });
        
        // 验证文件是否真的存在
        const { WorkspaceManager } = await import('../utils/WorkspaceManager');
        const projectWorkspace = WorkspaceManager.getProjectWorkspacePath(workspaceOptions);
        const prototypeDir = path.join(projectWorkspace, 'docs', 'prototype');
        const indexHtmlPath = path.join(prototypeDir, 'index.html');
        
        try {
          const fileStats = await fs.stat(indexHtmlPath);
          logger.info('GeneratePrototype: Verified prototype file exists', {
            path: indexHtmlPath,
            size: fileStats.size,
          });
        } catch (error: any) {
          logger.error('GeneratePrototype: Prototype file not found after generation', {
            path: indexHtmlPath,
            error: error.message,
          });
          // 不抛出错误，让流程继续，但记录警告
        }
        
        // CLI模式下，需要读取PRD内容作为返回的content
        let prdContent = '';
        try {
          prdContent = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD') || '';
        } catch (error: any) {
          logger.warn('GeneratePrototype: Failed to load PRD content for CLI mode', {
            error: error.message,
          });
        }
        
        // 构建files数组，与LLM模式保持一致
        const files = [{
          filename: 'index.html',
          path: indexHtmlPath,
        }];
        
        // 更新返回的content为PRD内容，并包含files信息
        return this.createActionOutput(
          prdContent || result.content,
          {
            ...result.data,
            type: 'prototype',
            filename: 'index.html',
            files: files,
            mainFile: 'index.html',
            workspaceDir: workspaceDir,
          }
        );
      }

      // LLM模式：继续使用现有逻辑
      // 1. 获取PRD内容
      let prdContent = options?.prdContent || input;
      
      // 如果未提供PRD内容，尝试从workspace读取
      if (!prdContent || prdContent.trim().length === 0) {
        const prdFromWorkspace = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD');
        if (prdFromWorkspace) {
          prdContent = prdFromWorkspace;
        } else {
          throw new Error('PRD content not found. Please provide PRD content or ensure PRD.md exists in workspace.');
        }
      }

      logger.info('GeneratePrototype: PRD content loaded', {
        prdLength: prdContent.length,
      });

      // 2. 加载系统提示词
      const systemPrompt = await this.loadSystemPrompt('prototype', 'system_prompt', PROTOTYPE_SYSTEM_PROMPT);

      // 3. 构建生成提示词
      const prompt = buildPrototypePrompt(prdContent);

      // 4. 调用LLM生成HTML原型
      logger.info('GeneratePrototype: Calling LLM to generate prototype');
      const htmlContent = await this.aask(prompt, [systemPrompt]);

      // 5. 解析HTML内容，确保只生成一个index.html文件
      const prototypeFiles = this.parsePrototypeFiles(htmlContent);

      // 6. 保存到workspace
      const savedFiles = await this.savePrototypeFiles(prototypeFiles, workspaceOptions);

      logger.info('GeneratePrototype: Prototype generation completed', {
        fileCount: savedFiles.length,
        files: savedFiles.map(f => f.filename),
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      // 7. 返回结果（应该只有一个index.html文件）
      // 注意：content 返回 PRD 内容，而不是生成完成的提示信息
      const mainFile = savedFiles.find(f => f.filename === 'index.html')?.filename || savedFiles[0]?.filename || 'index.html';
      return this.createActionOutput(
        prdContent, // 返回PRD内容，供前端显示
        {
          type: 'prototype',
          filename: mainFile,
          files: savedFiles,
          mainFile: mainFile,
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        }
      );
    } catch (error: any) {
      logger.error('GeneratePrototype: Failed to generate prototype', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 解析HTML内容，确保只生成一个index.html文件
   * 所有代码（HTML/CSS/JS）都必须在同一个HTML文件中
   */
  private parsePrototypeFiles(htmlContent: string): Array<{ filename: string; content: string }> {
    let cleanedContent = htmlContent.trim();

    // 1. 清理JSON格式的流式输出数据（如果存在）
    // 移除类似 {"type":"thinking",...} 或 {"type":"assistant",...} 的JSON行
    cleanedContent = cleanedContent.replace(/\{[\s\S]*?"type"\s*:\s*"(thinking|assistant|user|tool_call)"[\s\S]*?\}\s*/g, '');
    
    // 2. 提取markdown代码块中的HTML（```html ... ``` 或 ``` ... ```）
    const codeBlockPattern = /```(?:html)?\s*\n([\s\S]*?)\n```/gi;
    const codeBlockMatches = Array.from(cleanedContent.matchAll(codeBlockPattern));
    if (codeBlockMatches.length > 0) {
      // 使用最后一个代码块（通常是完整的HTML）
      cleanedContent = codeBlockMatches[codeBlockMatches.length - 1][1];
    }

    // 3. 提取tool_call中的streamContent（如果存在）
    const toolCallPattern = /"streamContent"\s*:\s*"([\s\S]*?)"/g;
    const toolCallMatches = Array.from(cleanedContent.matchAll(toolCallPattern));
    if (toolCallMatches.length > 0) {
      // 合并所有tool_call中的内容
      cleanedContent = toolCallMatches.map(m => m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')).join('\n');
    }

    // 4. 移除可能存在的代码块标记（如 ```html 或 ```）
    cleanedContent = cleanedContent.replace(/^```(?:html)?\s*\n?/i, '');
    cleanedContent = cleanedContent.replace(/\n?```\s*$/i, '');

    // 5. 移除markdown格式的说明文字（以#开头的标题行等，但保留HTML注释）
    // 只移除不在HTML标签内的markdown标题
    cleanedContent = cleanedContent.replace(/^#{1,6}\s+.*$/gm, '');
    cleanedContent = cleanedContent.replace(/^##\s+.*$/gm, '');
    
    // 6. 查找并提取完整的HTML代码
    // 优先查找完整的HTML文档结构
    const htmlDocPattern = /<!DOCTYPE\s+html>[\s\S]*?<\/html>/i;
    const htmlDocMatch = cleanedContent.match(htmlDocPattern);
    if (htmlDocMatch) {
      cleanedContent = htmlDocMatch[0];
    } else {
      // 如果没有完整的HTML文档，查找HTML标签
      const htmlTagPattern = /<html[\s\S]*?<\/html>/i;
      const htmlTagMatch = cleanedContent.match(htmlTagPattern);
      if (htmlTagMatch) {
        cleanedContent = htmlTagMatch[0];
      }
    }

    // 7. 清理多余的空行和空白字符
    cleanedContent = cleanedContent.trim();

    // 8. 检查是否已经是完整的HTML
    if (cleanedContent.includes('<!DOCTYPE html>') || 
        (cleanedContent.includes('<html') && cleanedContent.includes('</html>'))) {
      return [{ filename: 'index.html', content: cleanedContent }];
    }

    // 9. 如果仍然不是完整HTML，尝试包装
    // 但先检查是否包含HTML标签内容
    if (cleanedContent.includes('<body') || cleanedContent.includes('<div') || cleanedContent.includes('<main')) {
      const wrappedContent = this.wrapAsCompleteHTML(cleanedContent);
      return [{ filename: 'index.html', content: wrappedContent }];
    }

    // 10. 如果完全没有HTML内容，记录警告并返回空HTML
    logger.warn('GeneratePrototype: No valid HTML content found in LLM response', {
      contentLength: htmlContent.length,
      cleanedLength: cleanedContent.length,
      preview: cleanedContent.substring(0, 200),
    });

    // 返回一个基本的错误提示页面
    const errorHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>原型生成错误</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .error-container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 { color: #EF4444; margin-bottom: 16px; }
        p { color: #666; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>原型生成失败</h1>
        <p>未能从LLM响应中提取有效的HTML代码。请检查提示词配置或重试。</p>
    </div>
</body>
</html>`;
    
    return [{ filename: 'index.html', content: errorHTML }];
  }

  /**
   * 将内容包装成完整的HTML文件
   * 确保包含必要的CDN资源和基础样式，支持交互功能
   */
  private wrapAsCompleteHTML(content: string): string {
    // 如果已经是完整的HTML，直接返回
    if (content.includes('<!DOCTYPE html>') || (content.includes('<html') && content.includes('</html>'))) {
      return content;
    }

    // 否则包装成完整的HTML，包含必要的CDN资源和基础样式
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>产品原型</title>
    <!-- Element Plus CSS (PC端) -->
    <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
    <!-- Vue 3 -->
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <!-- Element Plus JS (PC端) -->
    <script src="https://unpkg.com/element-plus/dist/index.full.js"></script>
    <!-- Vant CSS (移动端，可选) -->
    <link rel="stylesheet" href="https://unpkg.com/vant@latest/lib/index.css">
    <!-- Vant JS (移动端，可选) -->
    <script src="https://unpkg.com/vant@latest/lib/vant.min.js"></script>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Inter', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        /* 基础间距体系（8px） */
        :root {
            --spacing-xs: 4px;
            --spacing-sm: 8px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
            /* 颜色规范 */
            --color-primary: #3B82F6;
            --color-success: #10B981;
            --color-warning: #F59E0B;
            --color-error: #EF4444;
            /* 圆角 */
            --border-radius: 12px;
        }
    </style>
</head>
<body>
${content}
</body>
</html>`;
  }

  /**
   * 保存原型文件到workspace
   */
  private async savePrototypeFiles(
    files: Array<{ filename: string; content: string }>,
    options: WorkspaceOptions
  ): Promise<Array<{ filename: string; path: string }>> {
    // 使用 getProjectWorkspacePath 获取项目工作空间路径
    // 然后在其下的 docs/prototype 目录保存文件
    const { WorkspaceManager } = await import('../utils/WorkspaceManager');
    const projectWorkspace = WorkspaceManager.getProjectWorkspacePath(options);
    const prototypeDir = path.join(projectWorkspace, 'docs', 'prototype');

    // 确保目录存在
    await fs.mkdir(prototypeDir, { recursive: true });

    const savedFiles: Array<{ filename: string; path: string }> = [];

    for (const file of files) {
      const filePath = path.join(prototypeDir, file.filename);
      await fs.writeFile(filePath, file.content, 'utf-8');
      savedFiles.push({
        filename: file.filename,
        path: filePath,
      });
    }

    return savedFiles;
  }
}

export default GeneratePrototype;
