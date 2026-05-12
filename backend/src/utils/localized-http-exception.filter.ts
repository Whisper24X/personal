import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';

type ExceptionResponseBody = Record<string, unknown>;

type PatternMatch = {
  key: string;
  args?: Record<string, unknown>;
};

const DEFAULT_LANGUAGE = 'zh';

const STATUS_MESSAGE_KEYS: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'errors.status.badRequest',
  [HttpStatus.UNAUTHORIZED]: 'errors.status.unauthorized',
  [HttpStatus.FORBIDDEN]: 'errors.status.forbidden',
  [HttpStatus.NOT_FOUND]: 'errors.status.notFound',
  [HttpStatus.CONFLICT]: 'errors.status.conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'errors.status.unprocessableEntity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'errors.status.internalServerError',
};

const ERROR_TITLE_KEYS = new Map<string, string>([
  ['Bad Request', 'errors.title.badRequest'],
  ['Unauthorized', 'errors.title.unauthorized'],
  ['Forbidden', 'errors.title.forbidden'],
  ['Not Found', 'errors.title.notFound'],
  ['Conflict', 'errors.title.conflict'],
  ['Unprocessable Entity', 'errors.title.unprocessableEntity'],
  ['Internal Server Error', 'errors.title.internalServerError'],
]);

const LEGACY_MESSAGE_KEYS = new Map<string, string>([
  [
    'Absolute file path is not allowed',
    'errors.common.absoluteFilePathNotAllowed',
  ],
  ['Absolute path is not allowed', 'errors.common.absolutePathNotAllowed'],
  [
    'Agent tool config name already exists',
    'errors.agentToolConfig.nameExists',
  ],
  ['Agent tool config not found', 'errors.agentToolConfig.notFound'],
  ['At least one file path is required', 'errors.workspace.filePathRequired'],
  ['At least one owner is required', 'errors.role.ownerRequired'],
  ['At least one project owner is required', 'errors.project.ownerRequired'],
  [
    'Already on the base branch; check out a feature branch to merge into the base',
    'errors.git.alreadyOnBaseBranch',
  ],
  ['Artifact not found', 'errors.task.artifactNotFound'],
  ['Automation name already exists', 'errors.automation.nameExists'],
  ['Automation not found', 'errors.automation.notFound'],
  [
    'Business line custom role not found',
    'errors.businessLine.customRoleNotFound',
  ],
  ['Business line member not found', 'errors.businessLine.memberNotFound'],
  ['Business line name already exists', 'errors.businessLine.nameExists'],
  ['Business line not found', 'errors.businessLine.notFound'],
  ['Business line role id is required', 'errors.businessLine.roleIdRequired'],
  ['Business line role not found', 'errors.businessLine.roleNotFound'],
  ['Cannot merge while in detached HEAD state', 'errors.git.detachedHeadMerge'],
  ['Commit SHA cannot be empty', 'errors.git.commitShaEmpty'],
  ['Commit message cannot be empty', 'errors.git.commitMessageEmpty'],
  ['Completed task cannot accept reply', 'errors.task.completedCannotReply'],
  ['Created MCP entry could not be loaded', 'errors.mcp.configNotFound'],
  [
    'Current MCP source format is not editable',
    'errors.mcp.sourceFormatNotEditable',
  ],
  [
    'Custom role name already exists in business line',
    'errors.role.customRoleNameExistsInBusinessLine',
  ],
  ['Custom role name is required', 'errors.role.customRoleNameRequired'],
  ['Doc file not found', 'errors.docs.docFileNotFound'],
  ['Docs file not found', 'errors.docs.docsFileNotFound'],
  ['Docs path cannot escape docs root', 'errors.docs.docsPathEscape'],
  [
    'Docs path not found or not a directory',
    'errors.docs.docsPathNotFoundOrNotDirectory',
  ],
  ['Failed to extract skill package', 'errors.skill.packageExtractFailed'],
  ['File not found', 'errors.common.fileNotFound'],
  ['File path cannot be empty', 'errors.workspace.filePathEmpty'],
  ['File path cannot escape workspace root', 'errors.workspace.filePathEscape'],
  ['Forbidden resource', 'errors.auth.forbiddenResource'],
  ['Invalid MCP servers payload', 'errors.mcp.serversPayloadInvalid'],
  ['Invalid MCP source path', 'errors.mcp.sourcePathInvalid'],
  ['Invalid business line asset path', 'errors.businessLine.assetPathInvalid'],
  [
    'Invalid default agent cli tool id',
    'errors.agentToolConfig.invalidDefaultToolId',
  ],
  ['Invalid git worktree name', 'errors.git.worktreeNameInvalid'],
  ['Invalid goal id', 'errors.common.invalidGoalId'],
  [
    'Invalid or expired invitation token',
    'errors.businessLine.invitationInvalidOrExpired',
  ],
  [
    'Invalid project id in invite payload',
    'errors.projectRole.invalidInviteProjectId',
  ],
  [
    'Invalid project id in member payload',
    'errors.projectRole.invalidMemberProjectId',
  ],
  [
    'Invalid project role in invite payload',
    'errors.projectRole.invalidInviteRole',
  ],
  [
    'Invalid project role in member payload',
    'errors.projectRole.invalidMemberRole',
  ],
  ['Invalid project role payload', 'errors.projectRole.invalidPayload'],
  ['Invalid skill name', 'errors.skill.invalidName'],
  ['Invalid skill name in SKILL.md', 'errors.skill.invalidNameInSkillMd'],
  ['Invalid skill package archive', 'errors.skill.packageArchiveInvalid'],
  ['Invalid tool id', 'errors.agentToolConfig.invalidToolId'],
  ['Invalid user session', 'errors.auth.invalidUserSession'],
  ['MCP args are only allowed for stdio type', 'errors.mcp.argsOnlyForStdio'],
  [
    'MCP command is required for stdio type',
    'errors.mcp.commandRequiredForStdio',
  ],
  ['MCP config not found', 'errors.mcp.configNotFound'],
  ['MCP env is only allowed for stdio type', 'errors.mcp.envOnlyForStdio'],
  ['MCP name already exists', 'errors.mcp.nameExists'],
  ['MCP name is required', 'errors.mcp.nameRequired'],
  ['MCP url is required for http/sse type', 'errors.mcp.urlRequiredForHttpSse'],
  [
    'Member already exists in business line',
    'errors.businessLine.memberExists',
  ],
  ['Member already exists in project', 'errors.project.memberExists'],
  ['No MCP server found in import payload', 'errors.mcp.noServerInPayload'],
  ['No completed node to repeat', 'errors.task.noCompletedNodeToRepeat'],
  [
    'No node available for reply execution',
    'errors.task.noNodeAvailableForReply',
  ],
  ['No runnable node in todo status', 'errors.task.noRunnableTodoNode'],
  ['Notification event not found', 'errors.notification.eventNotFound'],
  ['Notification setting not found', 'errors.notification.settingNotFound'],
  ['Only .zip package files are supported', 'errors.skill.zipOnly'],
  [
    'Only done, in_review, or failed node can be reset',
    'errors.task.resetNodeInvalidStatus',
  ],
  [
    'Only in_review node can be approved',
    'errors.task.inReviewNodeRequiredForApproval',
  ],
  [
    'Only in_review task can be completed',
    'errors.task.inReviewTaskRequiredForCompletion',
  ],
  [
    'Only task with all nodes done can be completed',
    'errors.task.allNodesDoneRequiredForCompletion',
  ],
  [
    'Owner cannot remove or downgrade self',
    'errors.role.ownerCannotModifySelf',
  ],
  ['Project MCP directory not found', 'errors.mcp.projectDirectoryNotFound'],
  ['Project custom role not found', 'errors.project.customRoleNotFound'],
  ['Project default role not found', 'errors.project.defaultRoleNotFound'],
  ['Project doc already exists', 'errors.docs.projectDocAlreadyExists'],
  ['Project doc not found', 'errors.docs.projectDocNotFound'],
  [
    'Project doc path cannot escape docs root',
    'errors.docs.projectDocPathEscape',
  ],
  ['Project doc path is a directory', 'errors.docs.projectDocIsDirectory'],
  ['Project doc path is required', 'errors.docs.projectDocPathRequired'],
  ['Project member not found', 'errors.project.memberNotFound'],
  [
    'Project name already exists in business line',
    'errors.project.nameExistsInBusinessLine',
  ],
  ['Project not found', 'errors.project.notFound'],
  [
    'Project owner cannot remove or downgrade self',
    'errors.project.ownerSelfProtection',
  ],
  ['Project role id is required', 'errors.project.roleIdRequired'],
  ['Project role not found', 'errors.project.roleNotFound'],
  [
    'Project workspace subdirectory (e.g. yanxue-main) does not exist. Please clone the repository first.',
    'errors.project.workspaceSubdirNotFound',
  ],
  [
    'ProjectId is required for non-admin users',
    'errors.access.projectIdRequired',
  ],
  ['Reply message cannot be empty', 'errors.task.replyMessageEmpty'],
  [
    'Role is assigned and cannot be deleted',
    'errors.role.assignedCannotDelete',
  ],
  ['Skill content not found', 'errors.skill.contentNotFound'],
  ['Skill directory not found', 'errors.skill.directoryNotFound'],
  ['Skill not found', 'errors.skill.notFound'],
  [
    'Skill package contains invalid path',
    'errors.skill.packageContainsInvalidPath',
  ],
  [
    'Skill package contains unsafe path',
    'errors.skill.packageContainsUnsafePath',
  ],
  ['Skill package file is required', 'errors.skill.packageFileRequired'],
  ['Skill package is empty', 'errors.skill.packageEmpty'],
  [
    'Skill path is outside allowed directory',
    'errors.skill.pathOutsideAllowedDirectory',
  ],
  ['Skill source path is unavailable', 'errors.skill.sourcePathUnavailable'],
  ['Task already has an in-progress node', 'errors.task.alreadyHasRunningNode'],
  [
    'Task already has an in-progress node and cannot accept reply',
    'errors.task.alreadyHasRunningNode',
  ],
  [
    'Task can be repeated only when done or has in_review node',
    'errors.task.repeatRequiresDoneOrInReview',
  ],
  [
    'Task config must include agentCliConfigId for executable task nodes',
    'errors.task.configAgentCliConfigIdRequired',
  ],
  [
    'Task config must include agentCliId for executable task nodes',
    'errors.task.configAgentCliIdRequired',
  ],
  [
    'Task reply cannot continue without agent session',
    'errors.task.replyCannotContinueWithoutSession',
  ],
  [
    'Task has failed node and cannot accept reply',
    'errors.task.failedNodeCannotReply',
  ],
  [
    'Task has failed node and cannot execute',
    'errors.task.failedNodeCannotExecute',
  ],
  [
    'Task has in_review node and cannot execute',
    'errors.task.inReviewNodeCannotExecute',
  ],
  [
    'Task has no in-progress node to cancel',
    'errors.task.noRunningNodeToCancel',
  ],
  ['Task must contain at least one node', 'errors.task.mustContainNode'],
  [
    'Task node cannot be reset because execution snapshot is unavailable',
    'errors.task.resetSnapshotUnavailable',
  ],
  ['Task node not found', 'errors.task.nodeNotFound'],
  ['Task not found', 'errors.task.notFound'],
  ['Task runtime initialization failed', 'errors.task.runtimeInitFailed'],
  ['Task workspace does not exist', 'errors.task.workspaceNotExist'],
  [
    'Task workspace is not a git repository',
    'errors.task.workspaceIsNotGitRepository',
  ],
  ['Task workspace is not initialized', 'errors.task.workspaceNotInitialized'],
  ['Task workspace path does not exist', 'errors.task.workspacePathNotExist'],
  ['Task worktree name already in use', 'errors.task.worktreeNameInUse'],
  ['Terminal session is not running', 'errors.task.terminalSessionNotRunning'],
  ['Terminal session not found', 'errors.task.terminalSessionNotFound'],
  ['Unsupported agent CLI tool id', 'errors.agentToolConfig.unsupportedToolId'],
  ['User not found', 'errors.auth.userNotFound'],
  [
    'Workflow mode requires configJson.workflowTemplateId',
    'errors.workflow.modeRequiresTemplateId',
  ],
  [
    'Workflow template only supports agent nodes',
    'errors.workflow.templateOnlySupportsAgentNodes',
  ],
  [
    'Working tree is not clean; commit or discard changes before merging',
    'errors.git.workingTreeNotClean',
  ],
  ['Workspace file not found', 'errors.workspace.fileNotFound'],
  ['Workspace path cannot escape root', 'errors.workspace.pathEscape'],
  ['Workspace path does not exist', 'errors.workspace.pathNotFound'],
  [
    'Workspace path must be a directory',
    'errors.workspace.pathMustBeDirectory',
  ],
  ['Workspace path must be a file', 'errors.workspace.pathMustBeFile'],
  ['Workspace path not found', 'errors.workspace.pathNotFound'],
  ['file is required', 'errors.common.fileRequired'],
  ['forbiddenBusinessLine', 'errors.access.forbiddenBusinessLine'],
  ['forbiddenObservabilityView', 'errors.access.forbiddenObservabilityView'],
  ['forbiddenProject', 'errors.access.forbiddenProject'],
  ['forbiddenQueueView', 'errors.access.forbiddenQueueView'],
  ['incorrectOldPassword', 'errors.auth.incorrectOldPassword'],
  ['incorrectPassword', 'errors.auth.incorrectPassword'],
  ['invalid memory relative path', 'errors.memory.relativePathInvalid'],
  ['memory doc already exists', 'errors.memory.docExists'],
  [
    'memory write only under docs/memory/',
    'errors.memory.writeOnlyUnderDocsMemory',
  ],
  ['missingOldPassword', 'errors.auth.missingOldPassword'],
  ['task not found', 'errors.task.notFound'],
  ['userNotFound', 'errors.auth.userNotFound'],
  ['usernameAlreadyExists', 'errors.auth.usernameAlreadyExists'],
]);

const LABEL_KEYS = new Map<string, string>([
  ['MCP', 'errors.label.MCP'],
  ['Skill', 'errors.label.Skill'],
  ['config', 'errors.label.config'],
  ['package', 'errors.label.package'],
]);

const GIT_OPERATION_KEYS = new Map<string, string>([
  ['Checkout failed', 'errors.git.operation.checkoutFailed'],
  [
    'Failed to checkout base branch',
    'errors.git.operation.checkoutBaseBranchFailed',
  ],
  [
    'Failed to clean worktree after reset',
    'errors.git.operation.cleanAfterResetFailed',
  ],
  ['Failed to commit changes', 'errors.git.operation.commitChangesFailed'],
  [
    'Failed to configure git commit identity',
    'errors.git.operation.configureCommitIdentityFailed',
  ],
  ['Failed to push changes', 'errors.git.operation.pushChangesFailed'],
  ['Failed to read branch diff', 'errors.git.operation.readBranchDiffFailed'],
  [
    'Failed to read branch diff files',
    'errors.git.operation.readBranchDiffFilesFailed',
  ],
  [
    'Failed to read current branch',
    'errors.git.operation.readCurrentBranchFailed',
  ],
  ['Failed to read git diff', 'errors.git.operation.readGitDiffFailed'],
  ['Failed to read git log', 'errors.git.operation.readGitLogFailed'],
  ['Failed to read git status', 'errors.git.operation.readGitStatusFailed'],
  [
    'Failed to reset worktree to target commit',
    'errors.git.operation.resetWorktreeFailed',
  ],
  [
    'Failed to stage changed files',
    'errors.git.operation.stageChangedFilesFailed',
  ],
  ['Failed to stage files', 'errors.git.operation.stageFilesFailed'],
  ['Failed to unstage files', 'errors.git.operation.unstageFilesFailed'],
  [
    'Failed to verify reset target commit',
    'errors.git.operation.verifyResetCommitFailed',
  ],
  ['Merge failed', 'errors.git.operation.mergeFailed'],
]);

const STATUS_TITLE_KEY_BY_STATUS: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'errors.title.badRequest',
  [HttpStatus.UNAUTHORIZED]: 'errors.title.unauthorized',
  [HttpStatus.FORBIDDEN]: 'errors.title.forbidden',
  [HttpStatus.NOT_FOUND]: 'errors.title.notFound',
  [HttpStatus.CONFLICT]: 'errors.title.conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'errors.title.unprocessableEntity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'errors.title.internalServerError',
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isI18nKey = (value: string): boolean => {
  return value.startsWith('errors.');
};

@Injectable()
@Catch()
export class LocalizedHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(LocalizedHttpExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const lang = I18nContext.current(host)?.lang ?? DEFAULT_LANGUAGE;
    const responseBody = this.normalizeResponseBody(
      isHttpException ? exception.getResponse() : {},
      status,
      lang,
    );

    if (!isHttpException) {
      this.logger.error(
        'Unhandled HTTP exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(responseBody);
  }

  private normalizeResponseBody(
    rawResponse: string | object,
    status: number,
    lang: string,
  ): ExceptionResponseBody {
    if (typeof rawResponse === 'string') {
      return {
        statusCode: status,
        message: this.translateMessage(rawResponse, status, lang),
        error: this.translateErrorTitle(rawResponse, status, lang),
      };
    }

    if (!isRecord(rawResponse)) {
      return {
        statusCode: status,
        message: this.translateStatusMessage(status, lang),
        error: this.translateErrorTitle('', status, lang),
      };
    }

    const body: ExceptionResponseBody = { ...rawResponse };
    body.statusCode = body.statusCode ?? body.status ?? status;
    body.message =
      body.message === undefined
        ? this.translateStatusMessage(status, lang)
        : this.localizeMessageValue(body.message, status, lang);

    if (body.error !== undefined && typeof body.error === 'string') {
      body.error = this.translateErrorTitle(body.error, status, lang);
    }

    if (body.errors !== undefined) {
      body.errors = this.localizeMessageValue(body.errors, status, lang);
    }

    return body;
  }

  private localizeMessageValue(
    value: unknown,
    status: number,
    lang: string,
  ): unknown {
    if (typeof value === 'string') {
      return this.translateMessage(value, status, lang);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.localizeMessageValue(item, status, lang));
    }

    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.localizeMessageValue(item, status, lang),
        ]),
      );
    }

    return value;
  }

  private translateMessage(
    value: string,
    status: number,
    lang: string,
  ): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return this.translateStatusMessage(status, lang);
    }

    if (isI18nKey(trimmed)) {
      return this.translateKey(trimmed, lang, undefined, trimmed);
    }

    const legacyKey = LEGACY_MESSAGE_KEYS.get(trimmed);
    if (legacyKey) {
      return this.translateKey(legacyKey, lang, undefined, trimmed);
    }

    const titleKey = ERROR_TITLE_KEYS.get(trimmed);
    if (titleKey) {
      return this.translateStatusMessage(status, lang);
    }

    const patternMatch = this.matchPatternMessage(trimmed, status, lang);
    if (patternMatch) {
      return this.translateKey(
        patternMatch.key,
        lang,
        patternMatch.args,
        trimmed,
      );
    }

    return trimmed;
  }

  private translateErrorTitle(
    value: string,
    status: number,
    lang: string,
  ): string {
    const titleKey =
      ERROR_TITLE_KEYS.get(value) ??
      STATUS_TITLE_KEY_BY_STATUS[status as HttpStatus] ??
      'errors.title.internalServerError';

    return this.translateKey(titleKey, lang, undefined, value || titleKey);
  }

  private translateStatusMessage(status: number, lang: string): string {
    const key =
      STATUS_MESSAGE_KEYS[status as HttpStatus] ??
      STATUS_MESSAGE_KEYS[HttpStatus.INTERNAL_SERVER_ERROR] ??
      'errors.status.internalServerError';

    return this.translateKey(key, lang, undefined, key);
  }

  private matchPatternMessage(
    value: string,
    status: number,
    lang: string,
  ): PatternMatch | null {
    const worktreeFileMatch = /^Worktree file not found: (.+)$/.exec(value);
    if (worktreeFileMatch) {
      return {
        key: 'errors.git.worktreeFileNotFound',
        args: { path: worktreeFileMatch[1] },
      };
    }

    const gitRepositoryMatch =
      /^Git repository is unreachable or unauthorized(?:: (.+))?$/.exec(value);
    if (gitRepositoryMatch) {
      return gitRepositoryMatch[1]
        ? {
            key: 'errors.git.repositoryUnreachableWithDetail',
            args: { detail: gitRepositoryMatch[1] },
          }
        : { key: 'errors.git.repositoryUnreachable' };
    }

    const gitFailureMatch = /^(.+?)(?: \(exit (\d+)\))?(?:: (.+))?$/.exec(
      value,
    );
    if (gitFailureMatch) {
      const operationKey = GIT_OPERATION_KEYS.get(gitFailureMatch[1]);
      if (operationKey) {
        const operation = this.translateKey(
          operationKey,
          lang,
          undefined,
          gitFailureMatch[1],
        );
        const exitCode = gitFailureMatch[2];
        const detail = gitFailureMatch[3];
        if (exitCode && detail) {
          return {
            key: 'errors.git.operationWithExitCodeAndDetail',
            args: { operation, exitCode, detail },
          };
        }
        if (exitCode) {
          return {
            key: 'errors.git.operationWithExitCode',
            args: { operation, exitCode },
          };
        }
        if (detail) {
          return {
            key: 'errors.git.operationWithDetail',
            args: { operation, detail },
          };
        }
        return { key: operationKey };
      }
    }

    const runtimeInitializationMatch =
      /^Task runtime initialization failed: (.+)$/.exec(value);
    if (runtimeInitializationMatch) {
      return {
        key: 'errors.task.runtimeInitFailedWithDetail',
        args: {
          detail: this.translateMessage(
            runtimeInitializationMatch[1],
            status,
            lang,
          ),
        },
      };
    }

    const dynamicFileMatch = /^(.+) file not found$/.exec(value);
    if (dynamicFileMatch) {
      return {
        key: 'errors.dynamic.fileNotFound',
        args: { label: this.translateLabel(dynamicFileMatch[1], lang) },
      };
    }

    const dynamicJsonObjectMatch = /^(.+) file must be a JSON object$/.exec(
      value,
    );
    if (dynamicJsonObjectMatch) {
      return {
        key: 'errors.dynamic.jsonObjectRequired',
        args: { label: this.translateLabel(dynamicJsonObjectMatch[1], lang) },
      };
    }

    const unsupportedCapabilityMatch =
      /^Capability (.+) is not supported in (business line|project) scope$/.exec(
        value,
      );
    if (unsupportedCapabilityMatch) {
      return {
        key:
          unsupportedCapabilityMatch[2] === 'project'
            ? 'errors.project.unsupportedCapability'
            : 'errors.businessLine.unsupportedCapability',
        args: { capability: unsupportedCapabilityMatch[1] },
      };
    }

    return this.matchDatabaseMessage(value);
  }

  private matchDatabaseMessage(value: string): PatternMatch | null {
    const createReference =
      /^Failed to create project: Referenced record not found/.exec(value);
    if (createReference) {
      return { key: 'errors.project.dbCreateReferenceNotFound' };
    }

    const createDuplicate = /^Failed to create project: Duplicate entry/.exec(
      value,
    );
    if (createDuplicate) {
      return { key: 'errors.project.dbCreateDuplicate' };
    }

    const createFailure = /^Failed to create project: (.+)$/.exec(value);
    if (createFailure) {
      return {
        key: 'errors.project.dbCreateFailed',
        args: { detail: createFailure[1] },
      };
    }

    const initReference =
      /^Failed to initialize project owner role: Referenced record not found/.exec(
        value,
      );
    if (initReference) {
      return { key: 'errors.project.dbInitOwnerReferenceNotFound' };
    }

    const initDuplicate =
      /^Failed to initialize project owner role: Duplicate entry/.exec(value);
    if (initDuplicate) {
      return { key: 'errors.project.dbInitOwnerDuplicate' };
    }

    const initFailure = /^Failed to initialize project owner role: (.+)$/.exec(
      value,
    );
    if (initFailure) {
      return {
        key: 'errors.project.dbInitOwnerFailed',
        args: { detail: initFailure[1] },
      };
    }

    return null;
  }

  private translateLabel(label: string, lang: string): string {
    const key = LABEL_KEYS.get(label);
    if (!key) {
      return label;
    }

    return this.translateKey(key, lang, undefined, label);
  }

  private translateKey(
    key: string,
    lang: string,
    args?: Record<string, unknown>,
    defaultValue?: string,
  ): string {
    return this.i18n.translate(key, {
      lang,
      args,
      defaultValue: defaultValue ?? key,
    });
  }
}
