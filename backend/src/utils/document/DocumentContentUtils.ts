/**
 * DocumentContentUtils
 * 文档内容处理工具函数
 * 
 * 提供文档内容处理的通用工具函数：
 * - 移除审查报告部分
 * - 提取目录
 * - 清理代码块标记
 * - 判断审核是否通过
 */

import { logger } from '../logger';

/**
 * 从文档中移除审查报告部分
 * 注意：只移除审查报告标题及其之后的内容，保留文档中其他的 --- 分隔符
 * 
 * @param document 文档内容
 * @param reviewTitlePattern 审查报告标题匹配模式
 * @returns 移除审查报告后的文档
 */
export function removeReviewReport(
  document: string,
  reviewTitlePattern: RegExp
): string {
  // 查找审查报告标题的位置
  const titleMatchIndex = document.search(reviewTitlePattern);
  
  if (titleMatchIndex === -1) {
    // 如果没有找到审查报告标题，返回原文档
    return document;
  }
  
  // 获取审查报告标题之前的内容
  let beforeTitle = document.substring(0, titleMatchIndex);
  
  // 只移除紧邻审查报告标题之前的 "---" 分隔符（如果存在）
  // 不要移除文档中其他位置的 --- 分隔符，因为它们可能是章节之间的分隔
  // 只检查最后几行是否是 --- 分隔符
  const lines = beforeTitle.split('\n');
  
  // 从后往前检查，只移除紧邻标题的空行和 --- 分隔符
  let trimEnd = lines.length;
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 5; i--) {
    const line = lines[i].trim();
    if (line === '') {
      // 空行，继续检查
      trimEnd = i;
    } else if (line === '---') {
      // 找到紧邻的分隔符，移除它和之后的空行
      trimEnd = i;
      break;
    } else {
      // 遇到非空、非分隔符的行，停止检查
      break;
    }
  }
  
  // 返回处理后的内容
  const result = lines.slice(0, trimEnd).join('\n').trim();
  
  logger.info('DocumentContentUtils: Removed review report from document', {
    originalLength: document.length,
    resultLength: result.length,
    removedFromIndex: titleMatchIndex,
  });
  
  return result;
}

/**
 * 判断审核是否通过
 * 
 * @param reviewContent 审核内容
 * @returns 是否通过
 */
export function isReviewPassed(reviewContent: string): boolean {
  // 检查审核结论部分
  const conclusionMatch = reviewContent.match(/##\s*\d*\.?\s*审查?结论[\s\S]*?(通过|需要改进|不通过)/i);
  if (conclusionMatch) {
    const conclusion = conclusionMatch[1];
    return conclusion === '通过';
  }
  
  // 检查是否有明确的通过标识
  if (reviewContent.includes('✅ 通过') && !reviewContent.includes('❌')) {
    return true;
  }
  
  // 检查审核结论中的关键词
  const lowerContent = reviewContent.toLowerCase();
  if (lowerContent.includes('通过') && !lowerContent.includes('需要改进') && !lowerContent.includes('不通过')) {
    return true;
  }
  if (lowerContent.includes('需要改进') || lowerContent.includes('不通过')) {
    return false;
  }
  
  // 默认需要改进
  return false;
}

/**
 * 判断章节审查是否需要改进
 * 通过解析审查结论来判断
 * 
 * @param reviewContent 审核内容
 * @returns 是否需要改进
 */
export function sectionNeedsImprovement(reviewContent: string): boolean {
  if (!reviewContent) return false;

  // 查找审查结论部分
  // 格式：### 4. 审查结论\n- 通过 / 需要改进
  const conclusionMatch = reviewContent.match(/###\s*\d*\.?\s*审查结论[\s\S]*?(?=###|$)/i);
  
  if (!conclusionMatch) {
    // 如果找不到审查结论，检查是否有"需要改进"关键字
    return reviewContent.includes('需要改进') || 
           reviewContent.includes('❌') ||
           reviewContent.includes('不通过');
  }

  const conclusion = conclusionMatch[0];
  
  // 如果结论中包含"需要改进"或"不通过"，则需要改进
  if (conclusion.includes('需要改进') || 
      conclusion.includes('不通过') ||
      conclusion.includes('❌')) {
    return true;
  }
  
  // 如果结论明确标注"通过"且不包含"需要改进"，则不需要改进
  if (conclusion.includes('通过') && !conclusion.includes('需要改进')) {
    return false;
  }

  // 默认情况下，如果有发现问题或改进建议，也认为需要改进
  if (reviewContent.includes('发现的问题') || reviewContent.includes('改进建议')) {
    // 检查是否有实际的问题内容
    const hasActualProblems = reviewContent.match(/问题描述[：:]\s*\S/);
    const hasActualSuggestions = reviewContent.match(/建议\s*\d+[：:]\s*\S/);
    return !!(hasActualProblems || hasActualSuggestions);
  }

  return false;
}

/**
 * 检查输入是否更像审查报告
 * 
 * @param input 输入内容
 * @returns 是否像审查报告
 */
export function looksLikeReviewReport(input: string): boolean {
  if (!input) return false;
  return input.includes('审查报告') || input.includes('改进建议');
}

/**
 * 清理代码块标记
 * 
 * @param content 原始内容
 * @returns 清理后的内容
 */
export function cleanCodeBlockMarkers(content: string): string {
  let cleaned = content.trim();
  
  // 移除开头的代码块标记
  const startPattern = /^```(?:markdown|md|text)?\s*\n?/i;
  if (startPattern.test(cleaned)) {
    cleaned = cleaned.replace(startPattern, '');
  }
  
  // 移除结尾的代码块标记
  const endPattern = /\n?```\s*$/;
  if (endPattern.test(cleaned)) {
    cleaned = cleaned.replace(endPattern, '');
  }
  
  return cleaned.trim();
}

/**
 * 从文档内容中提取目录
 * 
 * @param content 文档内容
 * @param defaultOutline 默认目录（如果无法提取）
 * @returns 目录内容
 */
export function extractOutline(content: string, defaultOutline?: string): string {
  const lines = content.split('\n');
  const outline: string[] = [];
  
  for (const line of lines) {
    // Match ## X. Title or ## X Title format
    const match = line.match(/^##\s+(\d+)\.?\s+(.+)$/);
    if (match) {
      outline.push(line);
    }
  }

  return outline.join('\n') || defaultOutline || '';
}
