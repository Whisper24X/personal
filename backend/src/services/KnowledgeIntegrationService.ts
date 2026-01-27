/**
 * 知识整合服务
 * 提供章节级知识检索和整合能力，用于 MRD/PRD 生成
 */

import { RAGService } from './RAGService';
import { 
  KnowledgeType,
  SectionKnowledgeMapping,
  getMRDSectionMapping,
  getPRDSectionMapping,
  generateSearchQueries,
  StructuredKnowledgeContext,
  createEmptyKnowledgeContext,
  mergeKnowledgeContexts,
  getKnowledgeContextStats,
} from '../prompts/knowledge';
import { logger } from '../utils';

/**
 * 章节知识检索选项
 */
export interface SectionKnowledgeOptions {
  /** 每种知识类型的检索数量限制 */
  limitPerType?: number;
  /** 是否使用并行检索 */
  parallel?: boolean;
  /** 最小相似度阈值 */
  minSimilarity?: number;
}

/**
 * 文档知识检索选项
 */
export interface DocumentKnowledgeOptions extends SectionKnowledgeOptions {
  /** 是否检索所有章节相关的知识 */
  allSections?: boolean;
  /** 指定章节编号（如果不检索所有章节） */
  sectionNumbers?: number[];
}

/**
 * 知识整合服务类
 */
export class KnowledgeIntegrationService {
  private ragService: RAGService;
  private initialized: boolean = false;

  constructor() {
    this.ragService = new RAGService();
  }

  /**
   * 初始化服务
   */
  async initialize(userId?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.ragService.initialize(userId);
      this.initialized = true;
      logger.info('KnowledgeIntegrationService: Initialized');
    } catch (error: any) {
      logger.warn('KnowledgeIntegrationService: Initialization failed', {
        error: error.message,
      });
      // 不抛出错误，允许降级使用
    }
  }

  /**
   * 获取 MRD 章节的知识上下文
   * 
   * @param projectId 项目ID
   * @param sectionNumber 章节编号
   * @param query 用户需求描述
   * @param options 检索选项
   * @returns 结构化知识上下文
   */
  async getMRDSectionKnowledge(
    projectId: string,
    sectionNumber: number,
    query: string,
    options?: SectionKnowledgeOptions
  ): Promise<StructuredKnowledgeContext> {
    const mapping = getMRDSectionMapping(sectionNumber);
    if (!mapping) {
      logger.warn('KnowledgeIntegrationService: No mapping found for MRD section', {
        sectionNumber,
      });
      return createEmptyKnowledgeContext();
    }

    return await this.getSectionKnowledge(projectId, mapping, query, options);
  }

  /**
   * 获取 PRD 章节的知识上下文
   * 
   * @param projectId 项目ID
   * @param sectionNumber 章节编号
   * @param query 用户需求描述（通常是 MRD 内容）
   * @param options 检索选项
   * @returns 结构化知识上下文
   */
  async getPRDSectionKnowledge(
    projectId: string,
    sectionNumber: number,
    query: string,
    options?: SectionKnowledgeOptions
  ): Promise<StructuredKnowledgeContext> {
    const mapping = getPRDSectionMapping(sectionNumber);
    if (!mapping) {
      logger.warn('KnowledgeIntegrationService: No mapping found for PRD section', {
        sectionNumber,
      });
      return createEmptyKnowledgeContext();
    }

    return await this.getSectionKnowledge(projectId, mapping, query, options);
  }

  /**
   * 获取 MRD 完整文档的知识上下文
   * 
   * @param projectId 项目ID
   * @param query 用户需求描述
   * @param options 检索选项
   * @returns 结构化知识上下文
   */
  async getMRDDocumentKnowledge(
    projectId: string,
    query: string,
    options?: DocumentKnowledgeOptions
  ): Promise<StructuredKnowledgeContext> {
    // 如果指定了 allSections=false 且提供了 sectionNumbers，则只检索指定章节
    // 否则检索所有章节（默认）
    const sectionNumbers = options?.sectionNumbers ?? [1, 2, 3, 4, 5, 6, 7];

    // 收集所有需要的知识类型
    const knowledgeTypes = new Set<KnowledgeType>();
    
    for (const sectionNum of sectionNumbers) {
      const mapping = getMRDSectionMapping(sectionNum);
      if (mapping) {
        mapping.knowledgeTypes.forEach(type => knowledgeTypes.add(type));
      }
    }

    // 使用 RAGService 获取结构化知识上下文
    return await this.ragService.getStructuredKnowledgeContext(
      projectId,
      query,
      Array.from(knowledgeTypes),
      options?.limitPerType ?? 3
    );
  }

  /**
   * 获取 PRD 完整文档的知识上下文
   * 
   * @param projectId 项目ID
   * @param query 用户需求描述（通常是 MRD 内容）
   * @param options 检索选项
   * @returns 结构化知识上下文
   */
  async getPRDDocumentKnowledge(
    projectId: string,
    query: string,
    options?: DocumentKnowledgeOptions
  ): Promise<StructuredKnowledgeContext> {
    // 如果指定了 allSections=false 且提供了 sectionNumbers，则只检索指定章节
    // 否则检索所有章节（默认）
    const sectionNumbers = options?.sectionNumbers ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // 收集所有需要的知识类型
    const knowledgeTypes = new Set<KnowledgeType>();
    
    for (const sectionNum of sectionNumbers) {
      const mapping = getPRDSectionMapping(sectionNum);
      if (mapping) {
        mapping.knowledgeTypes.forEach(type => knowledgeTypes.add(type));
      }
    }

    // 使用 RAGService 获取结构化知识上下文
    return await this.ragService.getStructuredKnowledgeContext(
      projectId,
      query,
      Array.from(knowledgeTypes),
      options?.limitPerType ?? 3
    );
  }

  /**
   * 根据章节映射获取知识上下文
   */
  private async getSectionKnowledge(
    projectId: string,
    mapping: SectionKnowledgeMapping,
    query: string,
    options?: SectionKnowledgeOptions
  ): Promise<StructuredKnowledgeContext> {
    const limitPerType = options?.limitPerType ?? 3;
    // parallel option is available for future use to optimize multi-type retrieval

    logger.info('KnowledgeIntegrationService: Getting section knowledge', {
      projectId,
      sectionNumber: mapping.sectionNumber,
      sectionTitle: mapping.sectionTitle,
      knowledgeTypes: mapping.knowledgeTypes,
      limitPerType,
    });

    try {
      // 生成检索查询
      const searchQueries = generateSearchQueries(mapping, query);
      
      // 使用第一个查询（最相关的）进行检索
      const primaryQuery = searchQueries[0] || query;

      // 使用 RAGService 获取结构化知识上下文
      const context = await this.ragService.getStructuredKnowledgeContext(
        projectId,
        primaryQuery,
        mapping.knowledgeTypes,
        limitPerType
      );

      const stats = getKnowledgeContextStats(context);
      logger.info('KnowledgeIntegrationService: Section knowledge retrieved', {
        sectionNumber: mapping.sectionNumber,
        totalChunks: stats.totalChunks,
        chunksByType: stats.chunksByType,
      });

      return context;
    } catch (error: any) {
      logger.error('KnowledgeIntegrationService: Failed to get section knowledge', {
        sectionNumber: mapping.sectionNumber,
        error: error.message,
      });
      return createEmptyKnowledgeContext();
    }
  }

  /**
   * 获取多个章节的合并知识上下文
   * 
   * @param projectId 项目ID
   * @param sectionNumbers 章节编号数组
   * @param query 用户需求描述
   * @param documentType 文档类型
   * @param options 检索选项
   * @returns 合并后的结构化知识上下文
   */
  async getMultipleSectionsKnowledge(
    projectId: string,
    sectionNumbers: number[],
    query: string,
    documentType: 'MRD' | 'PRD',
    options?: SectionKnowledgeOptions
  ): Promise<StructuredKnowledgeContext> {
    const getMapping = documentType === 'MRD' ? getMRDSectionMapping : getPRDSectionMapping;
    const parallel = options?.parallel ?? true;

    logger.info('KnowledgeIntegrationService: Getting multiple sections knowledge', {
      projectId,
      documentType,
      sectionNumbers,
    });

    try {
      if (parallel) {
        // 并行获取所有章节的知识
        const promises = sectionNumbers.map(sectionNum => {
          const mapping = getMapping(sectionNum);
          if (!mapping) {
            return Promise.resolve(createEmptyKnowledgeContext());
          }
          return this.getSectionKnowledge(projectId, mapping, query, options);
        });

        const contexts = await Promise.all(promises);
        return mergeKnowledgeContexts(contexts);
      } else {
        // 顺序获取
        const contexts: StructuredKnowledgeContext[] = [];
        for (const sectionNum of sectionNumbers) {
          const mapping = getMapping(sectionNum);
          if (mapping) {
            const context = await this.getSectionKnowledge(projectId, mapping, query, options);
            contexts.push(context);
          }
        }
        return mergeKnowledgeContexts(contexts);
      }
    } catch (error: any) {
      logger.error('KnowledgeIntegrationService: Failed to get multiple sections knowledge', {
        documentType,
        sectionNumbers,
        error: error.message,
      });
      return createEmptyKnowledgeContext();
    }
  }

  /**
   * 验证知识上下文
   * 检查是否存在可能的冲突或不一致
   * 
   * @param context 结构化知识上下文
   * @returns 验证结果
   */
  validateKnowledgeContext(context: StructuredKnowledgeContext): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 检查术语是否有重复定义
    const terminologyTerms = new Set<string>();
    for (const chunk of context.terminology) {
      const terms = this.extractTerms(chunk.content);
      for (const term of terms) {
        if (terminologyTerms.has(term)) {
          warnings.push(`术语"${term}"存在重复定义`);
        } else {
          terminologyTerms.add(term);
        }
      }
    }

    // 检查业务规则是否有潜在冲突
    if (context.businessRules.length > 1) {
      suggestions.push('存在多条业务规则，请确认规则之间不存在冲突');
    }

    // 检查功能定义
    if (context.existingFeatures.length > 0) {
      suggestions.push('参考了现有功能定义，请确保新功能与现有功能的关系明确');
    }

    // 检查技术约束
    if (context.techConstraints.length > 0) {
      suggestions.push('存在技术约束，请确保需求在约束范围内');
    }

    const isValid = warnings.length === 0;

    return { isValid, warnings, suggestions };
  }

  /**
   * 从文本中提取术语（简单实现）
   */
  private extractTerms(text: string): string[] {
    // 简单提取：查找引号中的内容或加粗的内容
    const terms: string[] = [];
    
    // 匹配引号中的内容
    const quoteMatches = text.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/g);
    if (quoteMatches) {
      terms.push(...quoteMatches.map(m => m.replace(/[「」"']/g, '')));
    }
    
    // 匹配 Markdown 加粗的内容
    const boldMatches = text.match(/\*\*([^*]+)\*\*/g);
    if (boldMatches) {
      terms.push(...boldMatches.map(m => m.replace(/\*\*/g, '')));
    }

    return terms;
  }
}

export default KnowledgeIntegrationService;
