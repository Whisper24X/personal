/**
 * Role Workspace Options Extractor
 * Extracts workspace options from messages and context
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
    GenerateTask: 'TASKS',
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
      if (data?.applicationId && data?.version) {
        return {
          applicationId: data.applicationId,
          projectId: data.projectId,
          version: data.version,
          documentType: this.getDocumentTypeForAction(actionName || ''),
        };
      }
    }

    // Fallback to context
    return this.extractFromContext(actionName);
  }

  /**
   * Parse workspace directory path
   */
  private parseWorkspaceDir(workspaceDir: string, actionName?: string): WorkspaceOptions | undefined {
    const pathParts = workspaceDir.split(path.sep).filter((p: string) => p);
    const versionIndex = pathParts.findIndex((p: string) => p.startsWith('v') && /^v\d+$/.test(p));

    if (versionIndex === -1) {
      return this.parseLegacyFormat(workspaceDir, actionName);
    }

    // New format: workspace/{applicationId}/{projectId}/v{version}/{documentType}/
    if (versionIndex > 1 && versionIndex < pathParts.length - 1) {
      return {
        applicationId: pathParts[versionIndex - 2],
        projectId: pathParts[versionIndex - 1],
        version: parseInt(pathParts[versionIndex].substring(1), 10),
        documentType: pathParts[versionIndex + 1] || this.getDocumentTypeForAction(actionName || ''),
      };
    }

    // Legacy format without projectId: workspace/{applicationId}/v{version}/{documentType}/
    if (versionIndex > 0 && versionIndex < pathParts.length - 1) {
      return {
        applicationId: pathParts[versionIndex - 1],
        version: parseInt(pathParts[versionIndex].substring(1), 10),
        documentType: pathParts[versionIndex + 1] || this.getDocumentTypeForAction(actionName || ''),
      };
    }

    return undefined;
  }

  /**
   * Parse legacy format: {applicationId}-v{version}-{documentType}
   */
  private parseLegacyFormat(workspaceDir: string, actionName?: string): WorkspaceOptions | undefined {
    const match = workspaceDir.match(/(.+)-v(\d+)-(.+)/);
    if (match) {
      return {
        applicationId: match[1],
        version: parseInt(match[2], 10),
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
        version: 1,
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

