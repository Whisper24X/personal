import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskNode } from '../domain/task-node';
import { TaskGitCommitIfChangedResult } from '../task-git.service';
import { TaskLogService } from './task-log.service';

const normalizeNodeName = (node: TaskNode): string => {
  const normalizedName = node.name.trim();

  return normalizedName || 'node';
};

const buildNodeCommitMessage = (
  node: TaskNode,
  action: 'approve' | 'complete',
): string => {
  return `chore(task): ${action} node #${node.nodeOrder} ${normalizeNodeName(node)}`;
};

export const buildApproveCommitMessage = (node: TaskNode): string => {
  return buildNodeCommitMessage(node, 'approve');
};

export const buildCompleteCommitMessage = (node: TaskNode): string => {
  return buildNodeCommitMessage(node, 'complete');
};

export const commitNodeWorkspaceIfChanged = async ({
  taskId,
  node,
  commitMessage,
  currentUser,
  commitIfChanged,
  taskLogService,
  committedLogMessage,
  skippedLogMessage,
  failedLogMessage,
}: {
  taskId: string;
  node: TaskNode;
  commitMessage: string;
  currentUser?: JwtPayloadType;
  commitIfChanged: (
    message: string,
    currentUser?: JwtPayloadType,
  ) => Promise<TaskGitCommitIfChangedResult>;
  taskLogService: Pick<TaskLogService, 'appendLog'>;
  committedLogMessage: string;
  skippedLogMessage: string;
  failedLogMessage: string;
}): Promise<TaskGitCommitIfChangedResult> => {
  try {
    const autoCommitResult = await commitIfChanged(commitMessage, currentUser);

    if (autoCommitResult.committed) {
      await taskLogService.appendLog({
        taskId,
        taskNodeId: node.id,
        level: TaskLogLevel.info,
        message: committedLogMessage,
        payload: {
          nodeOrder: node.nodeOrder,
          commitSha: autoCommitResult.commitSha ?? null,
          commitSubject: autoCommitResult.subject ?? commitMessage,
        },
      });
    } else {
      await taskLogService.appendLog({
        taskId,
        taskNodeId: node.id,
        level: TaskLogLevel.info,
        message: skippedLogMessage,
        payload: {
          nodeOrder: node.nodeOrder,
        },
      });
    }

    return autoCommitResult;
  } catch (error) {
    await taskLogService.appendLog({
      taskId,
      taskNodeId: node.id,
      level: TaskLogLevel.error,
      message: failedLogMessage,
      payload: {
        nodeOrder: node.nodeOrder,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
};
