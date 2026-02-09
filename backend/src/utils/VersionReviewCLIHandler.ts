/**
 * 版本审查类型定义
 * 保留类型定义供其他地方使用，CLI 交互逻辑已移除
 */

import { QuestionType } from '../prompts/versionReview';

/**
 * 审查进度信息（保留用于类型定义）
 */
export interface ReviewProgress {
  currentRound: number;
  totalRounds: number;
  questionType: QuestionType;
  question: string;
}
