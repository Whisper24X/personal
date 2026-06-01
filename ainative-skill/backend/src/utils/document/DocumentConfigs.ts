/**
 * Document Configurations
 * 文档类型配置注册
 */

import { CLIModeConfig } from './types';

/**
 * 预定义的文档类型配置
 */
export const DOCUMENT_CONFIGS: Record<string, CLIModeConfig> = {
  PRD: {
    documentType: 'PRD',
    mainFileName: 'PRD.md',
    reviewFileName: 'PRD_REVIEW.md',
    fileDescription: '产品需求文档',
    reviewDescription: 'PRD审核报告',
  },
  MRD: {
    documentType: 'MRD',
    mainFileName: 'MRD.md',
    reviewFileName: 'MRD_REVIEW.md',
    fileDescription: '市场需求文档',
    reviewDescription: 'MRD审核报告',
  },
  DESIGN: {
    documentType: 'DESIGN',
    mainFileName: 'DESIGN.md',
    reviewFileName: 'DESIGN_REVIEW.md',
    fileDescription: '系统设计文档',
    reviewDescription: '设计审核报告',
  },
  TEST: {
    documentType: 'TEST',
    mainFileName: 'TEST.md',
    reviewFileName: 'TEST_REVIEW.md',
    fileDescription: '测试文档',
    reviewDescription: '测试审核报告',
  },
  TEST_PLAN: {
    documentType: 'TEST_PLAN',
    mainFileName: 'TEST_PLAN.md',
    reviewFileName: 'TEST_PLAN_REVIEW.md',
    fileDescription: '测试计划文档',
    reviewDescription: '测试计划审核报告',
  },
  TESTABILITY: {
    documentType: 'TESTABILITY',
    mainFileName: 'TESTABILITY.md',
    reviewFileName: 'TESTABILITY_REVIEW.md',
    fileDescription: '可测试性文档',
    reviewDescription: '可测试性审核报告',
  },
  PROTOTYPE: {
    documentType: 'PROTOTYPE',
    mainFileName: 'index.html',
    reviewFileName: 'PROTOTYPE_REVIEW.md',
    fileDescription: '高保真HTML原型',
    reviewDescription: '原型审核报告',
  },
};

/**
 * 获取文档配置
 * @param documentType 文档类型
 * @returns 文档配置，如果未找到则返回undefined
 */
export function getDocumentConfig(documentType: string): CLIModeConfig | undefined {
  return DOCUMENT_CONFIGS[documentType.toUpperCase()];
}

/**
 * 注册自定义文档配置
 * @param documentType 文档类型
 * @param config 文档配置
 */
export function registerDocumentConfig(documentType: string, config: CLIModeConfig): void {
  DOCUMENT_CONFIGS[documentType.toUpperCase()] = config;
}
