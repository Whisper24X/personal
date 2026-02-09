/**
 * CLI Knowledge Search Service
 * 使用CLI工具在文件系统中搜索知识库内容
 */

import { CLIExecutor } from '../executors/CLIExecutor';
import { logger } from '../utils/logger';

export interface CLIKnowledgeSearchResult {
  file: string; // 文件路径（相对于workspace）
  content: string; // 匹配的内容片段
  relevance: number; // 相关性评分（0-1）
  metadata?: {
    title?: string;
    tags?: string[];
  };
}

export interface CLISearchOptions {
  workspacePath: string;
  query: string;
  limit?: number;
  directories?: string[]; // 要搜索的目录列表，默认搜索 docs/business-knowledge/
  cliConfig?: {
    provider?: string;
    model?: string;
    timeout?: number;
  };
}

export class CLIKnowledgeSearchService {
  /**
   * 在文件系统中搜索知识库内容
   * @param options 搜索选项
   * @returns 搜索结果列表
   */
  async search(options: CLISearchOptions): Promise<CLIKnowledgeSearchResult[]> {
    const { workspacePath, query, limit = 5, directories = ['docs/business-knowledge/'], cliConfig } = options;

    logger.info('CLIKnowledgeSearchService: Starting search', {
      workspacePath,
      query,
      limit,
      directories,
    });

    try {
      // 构建搜索prompt
      const searchPrompt = this.buildSearchPrompt(query, directories, limit);

      // 创建CLI执行器
      const executor = new CLIExecutor({
        providerType: (cliConfig?.provider as any) || 'cursor',
        providerConfig: {
          model: cliConfig?.model || 'composer-1',
          timeout: cliConfig?.timeout || 60000, // 60秒超时
        },
        defaultWorkDir: workspacePath,
      });

      // 执行搜索
      const result = await executor.execute(searchPrompt, {
        workDir: workspacePath,
      });

      // 解析搜索结果
      const searchResults = this.parseSearchResults(result, directories);

      // 限制结果数量
      const limitedResults = searchResults.slice(0, limit);

      logger.info('CLIKnowledgeSearchService: Search completed', {
        query,
        resultsCount: limitedResults.length,
      });

      return limitedResults;
    } catch (error: any) {
      logger.error('CLIKnowledgeSearchService: Search failed', {
        error: error.message,
        query,
        workspacePath,
      });
      // 如果CLI搜索失败，返回空结果而不是抛出错误
      return [];
    }
  }

  /**
   * 构建搜索prompt
   */
  private buildSearchPrompt(query: string, directories: string[], limit: number): string {
    const dirsList = directories.map((dir) => `- ${dir}`).join('\n');

    return `在以下目录中搜索与查询相关的内容：

查询：${query}
目录：
${dirsList}

要求：
1. 返回最相关的文件片段（最多${limit}个）
2. 每个片段必须包含以下信息：
   - 文件路径（相对于工作目录）
   - 内容摘要（200-300字，包含与查询相关的关键信息）
   - 相关性说明（为什么这个片段与查询相关）
3. 按相关性从高到低排序
4. 如果找到相关内容，必须引用；如果未找到，返回空列表

输出格式（JSON数组）：
[
  {
    "file": "docs/business-knowledge/example.md",
    "content": "内容摘要...",
    "relevance": 0.9,
    "metadata": {
      "title": "文档标题",
      "tags": ["标签1", "标签2"]
    }
  }
]

请严格按照JSON格式输出，不要包含其他文字说明。`;
  }

  /**
   * 解析CLI返回的搜索结果
   */
  private parseSearchResults(cliOutput: string, _directories: string[]): CLIKnowledgeSearchResult[] {
    try {
      // 尝试提取JSON部分（可能包含在markdown代码块中）
      let jsonStr = cliOutput.trim();

      // 移除markdown代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      // 尝试找到JSON数组的开始和结束
      const jsonStart = jsonStr.indexOf('[');
      const jsonEnd = jsonStr.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      // 解析JSON
      const results = JSON.parse(jsonStr) as any[];

      // 验证和转换结果
      return results
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any) => ({
          file: item.file || '',
          content: item.content || '',
          relevance: typeof item.relevance === 'number' ? Math.max(0, Math.min(1, item.relevance)) : 0.5,
          metadata: item.metadata || {},
        }))
        .filter((item) => item.file && item.content); // 过滤无效结果
    } catch (error: any) {
      logger.warn('CLIKnowledgeSearchService: Failed to parse CLI output as JSON', {
        error: error.message,
        outputPreview: cliOutput.substring(0, 500),
      });

      // 如果JSON解析失败，尝试从文本中提取信息
      return this.parseTextResults(cliOutput);
    }
  }

  /**
   * 从文本输出中解析搜索结果（fallback方法）
   */
  private parseTextResults(text: string): CLIKnowledgeSearchResult[] {
    const results: CLIKnowledgeSearchResult[] = [];
    const lines = text.split('\n');

    let currentFile = '';
    let currentContent: string[] = [];
    let currentRelevance = 0.5;

    for (const line of lines) {
      // 检测文件路径
      if (line.includes('docs/') || line.includes('business-knowledge')) {
        const fileMatch = line.match(/(docs\/[^\s]+\.md)/);
        if (fileMatch) {
          // 保存上一个结果
          if (currentFile && currentContent.length > 0) {
            results.push({
              file: currentFile,
              content: currentContent.join(' ').substring(0, 500),
              relevance: currentRelevance,
            });
          }
          // 开始新结果
          currentFile = fileMatch[1];
          currentContent = [];
          currentRelevance = 0.5;
        }
      }

      // 检测相关性评分
      const relevanceMatch = line.match(/relevance[:\s]+([\d.]+)/i);
      if (relevanceMatch) {
        currentRelevance = parseFloat(relevanceMatch[1]) || 0.5;
      }

      // 收集内容
      if (currentFile && line.trim() && !line.includes('file:') && !line.includes('relevance:')) {
        currentContent.push(line.trim());
      }
    }

    // 保存最后一个结果
    if (currentFile && currentContent.length > 0) {
      results.push({
        file: currentFile,
        content: currentContent.join(' ').substring(0, 500),
        relevance: currentRelevance,
      });
    }

    // 按相关性排序
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }
}
