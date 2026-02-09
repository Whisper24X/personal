/**
 * Knowledge Retrieval Helper
 * 根据章节知识映射检索相关知识库内容
 */

import {
  KnowledgeType,
  KnowledgeChunk,
  getMRDSectionMapping,
  getPRDSectionMapping,
  getKnowledgePaths,
  generateSearchQueries,
  MRD_SECTION_KNOWLEDGE_MAP,
  PRD_SECTION_KNOWLEDGE_MAP,
} from '../../prompts/knowledge';
import { CLIKnowledgeSearchService } from '../../services/CLIKnowledgeSearchService';
import { logger } from '../logger';

export interface KnowledgeRetrievalOptions {
  workspacePath: string;
  sectionNumber: number;
  documentType: 'MRD' | 'PRD';
  userQuery: string;
  limit?: number;
  cliConfig?: {
    provider?: string;
    model?: string;
    timeout?: number;
  };
}

export class KnowledgeRetrievalHelper {
  private cliSearchService: CLIKnowledgeSearchService;

  constructor() {
    this.cliSearchService = new CLIKnowledgeSearchService();
  }

  /**
   * 根据章节映射检索相关知识库内容
   * @param options 检索选项
   * @returns 知识片段列表
   */
  async retrieveKnowledgeForSection(options: KnowledgeRetrievalOptions): Promise<KnowledgeChunk[]> {
    const { workspacePath, sectionNumber, documentType, userQuery, limit = 5, cliConfig } = options;

    logger.info('KnowledgeRetrievalHelper: Retrieving knowledge for section', {
      sectionNumber,
      documentType,
      userQueryLength: userQuery.length,
    });

    // 获取章节映射
    const mapping = documentType === 'MRD' ? getMRDSectionMapping(sectionNumber) : getPRDSectionMapping(sectionNumber);

    if (!mapping) {
      logger.warn('KnowledgeRetrievalHelper: No mapping found for section', {
        sectionNumber,
        documentType,
      });
      return [];
    }

    // 生成检索查询
    const searchQueries = generateSearchQueries(mapping, userQuery);

    // 获取知识类型对应的目录路径
    const directories = getKnowledgePaths(mapping.knowledgeTypes);

    if (directories.length === 0) {
      logger.warn('KnowledgeRetrievalHelper: No directories found for knowledge types', {
        knowledgeTypes: mapping.knowledgeTypes,
      });
      return [];
    }

    // 执行搜索（使用第一个查询，或合并所有查询）
    const combinedQuery = searchQueries.join(' ');

    try {
      const searchResults = await this.cliSearchService.search({
        workspacePath,
        query: combinedQuery,
        limit,
        directories,
        cliConfig,
      });

      // 转换为KnowledgeChunk格式
      const knowledgeChunks: KnowledgeChunk[] = searchResults.map((result) => {
        // 根据文件路径推断知识类型
        const knowledgeType = this.inferKnowledgeTypeFromPath(result.file, mapping.knowledgeTypes);

        // 提取文档标题（从文件名或metadata）
        const sourceTitle = result.metadata?.title || result.file.split('/').pop()?.replace('.md', '').replace(/_/g, ' ') || 'Unknown';

        return {
          content: result.content,
          type: knowledgeType,
          sourceTitle,
          similarity: result.relevance,
        };
      });

      logger.info('KnowledgeRetrievalHelper: Retrieved knowledge chunks', {
        sectionNumber,
        chunksCount: knowledgeChunks.length,
      });

      return knowledgeChunks;
    } catch (error: any) {
      logger.error('KnowledgeRetrievalHelper: Failed to retrieve knowledge', {
        error: error.message,
        sectionNumber,
        documentType,
      });
      return [];
    }
  }

  /**
   * 生成章节相关的检索查询
   * @param sectionNumber 章节编号
   * @param documentType 文档类型
   * @param userQuery 用户查询
   * @returns 检索查询数组
   */
  generateSearchQueries(sectionNumber: number, documentType: 'MRD' | 'PRD', userQuery: string): string[] {
    const mapping = documentType === 'MRD' ? getMRDSectionMapping(sectionNumber) : getPRDSectionMapping(sectionNumber);

    if (!mapping) {
      return [];
    }

    return generateSearchQueries(mapping, userQuery);
  }

  /**
   * 根据文件路径推断知识类型
   */
  private inferKnowledgeTypeFromPath(filePath: string, possibleTypes: KnowledgeType[]): KnowledgeType {
    // 根据路径特征推断类型
    if (filePath.includes('business-knowledge')) {
      return possibleTypes.includes(KnowledgeType.BUSINESS_RULES) ? KnowledgeType.BUSINESS_RULES : possibleTypes[0];
    }
    if (filePath.includes('docs-archive/prd')) {
      return possibleTypes.includes(KnowledgeType.HISTORY_PRD) ? KnowledgeType.HISTORY_PRD : possibleTypes[0];
    }
    if (filePath.includes('docs-archive/mrd')) {
      return possibleTypes.includes(KnowledgeType.HISTORY_MRD) ? KnowledgeType.HISTORY_MRD : possibleTypes[0];
    }
    if (filePath.includes('dev-spec')) {
      return possibleTypes.includes(KnowledgeType.DEV_SPEC) ? KnowledgeType.DEV_SPEC : possibleTypes[0];
    }

    // 默认返回第一个可能的类型
    return possibleTypes[0] || KnowledgeType.BUSINESS_RULES;
  }

  /**
   * 检索所有章节的知识库内容
   * @param options 检索选项（不包含sectionNumber）
   * @returns 按章节组织的知识片段映射
   */
  async retrieveKnowledgeForAllSections(
    options: Omit<KnowledgeRetrievalOptions, 'sectionNumber'> & {
      documentType: 'MRD' | 'PRD';
      sectionNumbers?: number[]; // 如果未指定，检索所有章节
    }
  ): Promise<Map<number, KnowledgeChunk[]>> {
    const { documentType, sectionNumbers, ...baseOptions } = options;

    // 确定要检索的章节列表
    let sectionsToRetrieve: number[];
    if (sectionNumbers) {
      sectionsToRetrieve = sectionNumbers;
    } else {
      // 根据文档类型获取所有章节编号
      const allMappings = documentType === 'MRD' ? MRD_SECTION_KNOWLEDGE_MAP : PRD_SECTION_KNOWLEDGE_MAP;
      sectionsToRetrieve = allMappings.map((m) => m.sectionNumber);
    }

    // 并行检索所有章节
    const retrievalPromises = sectionsToRetrieve.map((sectionNumber) =>
      this.retrieveKnowledgeForSection({
        ...baseOptions,
        sectionNumber,
        documentType,
      }).then((chunks) => ({ sectionNumber, chunks }))
    );

    const results = await Promise.all(retrievalPromises);

    // 构建映射
    const knowledgeMap = new Map<number, KnowledgeChunk[]>();
    for (const { sectionNumber, chunks } of results) {
      if (chunks.length > 0) {
        knowledgeMap.set(sectionNumber, chunks);
      }
    }

    return knowledgeMap;
  }
}
