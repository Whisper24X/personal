/**
 * Stage configuration for workflow roles and actions
 * Centralizes all stage-related mappings for consistency
 */

export type TagType = 'success' | 'warning' | 'info' | 'danger';

export interface StageInfo {
  name: string;
  color: TagType;
}

// Role to default stage mapping
export const ROLE_DEFAULT_STAGES: Record<string, StageInfo> = {
  Salesperson: { name: '市场研究阶段', color: 'info' },
  ProductManager: { name: '产品需求阶段', color: 'success' },
  Architect: { name: '系统设计阶段', color: 'warning' },
  ProjectManager: { name: '任务拆分阶段', color: 'warning' },
  Engineer: { name: '代码实现阶段', color: 'danger' },
  QAEngineer: { name: '测试编写阶段', color: 'danger' },
};

// Action to stage mapping (role-specific)
export const ACTION_STAGE_MAP: Record<string, Record<string, string>> = {
  Salesperson: {
    WriteMRD: '市场研究阶段',
    MRDReview: '市场研究阶段',
    RequirementSpecReview: '市场研究阶段',
    WriteRequirementSpec: '市场研究阶段',
  },
  ProductManager: {
    WritePRD: '产品需求阶段',
    PRDReview: '产品需求阶段',
    ImproveDocument: '产品需求阶段',
  },
  Architect: {
    WriteDesign: '系统设计阶段',
  },
  ProjectManager: {
    FillProjectContext: '任务拆分阶段',
    CreateOpenSpecProposal: '任务拆分阶段',
    ValidateOpenSpecProposal: '任务拆分阶段',
    EstimateStoryPoints: '任务拆分阶段',
    ValidateStoryPointEstimates: '任务拆分阶段',
  },
  Engineer: {
    WriteCode: '代码实现阶段',
    ExecuteSubtask: '代码实现阶段',
  },
  QAEngineer: {
    WriteTest: '测试编写阶段',
  },
};

// Stage name to color mapping
export const STAGE_COLOR_MAP: Record<string, TagType> = {
  '市场研究阶段': 'info',
  '产品需求阶段': 'success',
  '系统设计阶段': 'warning',
  '任务拆分阶段': 'warning',
  '代码实现阶段': 'danger',
  '测试编写阶段': 'danger',
};

/**
 * Get stage name based on role and action
 */
export function getStageName(role: string, action: string): string {
  const roleStages = ACTION_STAGE_MAP[role] || {};
  if (roleStages[action]) {
    return roleStages[action];
  }
  return ROLE_DEFAULT_STAGES[role]?.name || `${role} - ${action}`;
}

/**
 * Get tag type (color) for a stage name
 */
export function getStageTagType(stageName: string): TagType {
  if (!stageName) return 'info';
  
  // Check for exact match first
  if (STAGE_COLOR_MAP[stageName]) {
    return STAGE_COLOR_MAP[stageName];
  }
  
  // Fallback to partial match
  for (const [key, color] of Object.entries(STAGE_COLOR_MAP)) {
    if (stageName.includes(key.replace('阶段', ''))) {
      return color;
    }
  }
  
  return 'info';
}

/**
 * Get role tag type (color) for kanban column
 */
export function getRoleTagType(role: string): TagType {
  return ROLE_DEFAULT_STAGES[role]?.color || 'info';
}
