/**
 * Role Workspace Options Extractor
 * Extracts workspace options from messages and context
 * 
 * 新目录结构: workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}
 */

import * as path from 'path';
import { WorkspaceOptions } from '../utils';
import { RoleContext } from '../core/context/RoleContext';
import { Context } from '../core/context/Context';

export class RoleWorkspaceExtractor {
  private static readonly DOCUMENT_TYPE_MAP: Record<string, string> = {
    WriteMRD: 'MRD',
    WritePRD: 'PRD',
    WriteDesign: 'DESIGN',
    WriteSubProjectDesign: 'DESIGN',
    BreakdownTasks: 'TASKS',
    WriteCode: 'CODE',
    WriteTest: 'TEST',
    ExecuteSubtask: 'CODE',
  };

  constructor(
    private rc: RoleContext,
    private context: Context
  ) {}

  /**
   * Extract workspace options from messages
   */
  extractWorkspaceOptions(actionName?: string): WorkspaceOptions | undefined {
    const messagesToCheck = [
      ...this.rc.news,
      ...this.rc.memory.getByAction('WritePRD'),
      ...this.rc.memory.getByAction('WriteDesign'),
      ...this.rc.memory.getByAction('WriteMRD'),
    ];

    for (const msg of messagesToCheck) {
      const data = msg.instructContent as any;
      
      // Try to extract from workspaceDir
      if (data?.workspaceDir) {
        const options = this.parseWorkspaceDir(data.workspaceDir, actionName);
        if (options) {
          return options;
        }
      }

      // Try direct properties
      if (data?.applicationId && data?.projectId) {
        return {
          applicationId: data.applicationId,
          projectId: data.projectId,
          documentType: this.getDocumentTypeForAction(actionName || ''),
        };
      }
    }

    // Fallback to context
    return this.extractFromContext(actionName);
  }

  /**
   * Parse workspace directory path
   * 新格式: workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}
   */
  private parseWorkspaceDir(workspaceDir: string, actionName?: string): WorkspaceOptions | undefined {
    const pathParts = workspaceDir.split(path.sep).filter((p: string) => p);
    
    // 查找 ainative-workspace 标识
    const workspaceIndex = pathParts.findIndex((p: string) => p === 'ainative-workspace');

    if (workspaceIndex !== -1) {
      // 新格式: workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}
      if (workspaceIndex >= 2) {
        const workspaceRootIndex = pathParts.findIndex((p: string) => p === 'workspace');
        if (workspaceRootIndex !== -1 && workspaceRootIndex < workspaceIndex - 2) {
          return {
            applicationId: pathParts[workspaceRootIndex + 1],
            projectId: pathParts[workspaceRootIndex + 2],
            documentType: pathParts[workspaceIndex + 2] || this.getDocumentTypeForAction(actionName || ''),
          };
        }
        return {
          applicationId: pathParts[workspaceIndex - 2],
          projectId: pathParts[workspaceIndex - 1],
          documentType: pathParts[workspaceIndex + 2] || this.getDocumentTypeForAction(actionName || ''),
        };
      }
    }

    // 尝试解析旧格式以保持向后兼容
    return this.parseLegacyFormat(workspaceDir, actionName);
  }

  /**
   * Parse legacy format (for backward compatibility)
   */
  private parseLegacyFormat(workspaceDir: string, actionName?: string): WorkspaceOptions | undefined {
    const pathParts = workspaceDir.split(path.sep).filter((p: string) => p);
    const versionIndex = pathParts.findIndex((p: string) => p.startsWith('v') && /^v\d+$/.test(p));

    // 旧格式: workspace/{applicationId}/{projectId}/v{version}/{documentType}/
    if (versionIndex > 1 && versionIndex < pathParts.length - 1) {
      return {
        applicationId: pathParts[versionIndex - 2],
        projectId: pathParts[versionIndex - 1],
        documentType: pathParts[versionIndex + 1] || this.getDocumentTypeForAction(actionName || ''),
      };
    }

    // 尝试匹配 {applicationId}-v{version}-{documentType} 格式
    const match = workspaceDir.match(/(.+)-v(\d+)-(.+)/);
    if (match) {
      return {
        applicationId: match[1],
        documentType: match[3] || this.getDocumentTypeForAction(actionName || ''),
      };
    }

    return undefined;
  }

  /**
   * Extract from context as fallback
   */
  private extractFromContext(actionName?: string): WorkspaceOptions | undefined {
    const applicationId = this.context?.get('applicationId');
    const projectId = this.context?.get('projectId');
    
    if (applicationId && projectId) {
      return {
        applicationId: applicationId as string,
        projectId: projectId as string,
        documentType: this.getDocumentTypeForAction(actionName || ''),
      };
    }
    
    return undefined;
  }

  /**
   * Get document type for action
   */
  private getDocumentTypeForAction(actionName: string): string {
    return RoleWorkspaceExtractor.DOCUMENT_TYPE_MAP[actionName] || 'DOCS';
  }
}
