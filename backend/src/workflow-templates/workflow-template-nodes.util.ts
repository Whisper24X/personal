import { ConflictException } from '@nestjs/common';
import { WorkflowTemplateNodeDto } from './dto/workflow-template-node.dto';

export function ensureValidWorkflowTemplateNodes(
  nodes: WorkflowTemplateNodeDto[],
): void {
  const nodeOrderSet = new Set<number>();
  const sortedOrders = [...nodes]
    .map((node) => node.nodeOrder)
    .sort((left, right) => left - right);

  for (const node of nodes) {
    if (nodeOrderSet.has(node.nodeOrder)) {
      throw new ConflictException(
        'Workflow template node_order must be unique',
      );
    }

    nodeOrderSet.add(node.nodeOrder);
  }

  const hasStartNode = sortedOrders[0] === 1;

  if (!hasStartNode) {
    throw new ConflictException(
      'Workflow template requires node_order starting from 1',
    );
  }

  for (let index = 0; index < sortedOrders.length; index += 1) {
    const expectedNodeOrder = index + 1;
    if (sortedOrders[index] !== expectedNodeOrder) {
      throw new ConflictException(
        'Workflow template node_order must be continuous from 1',
      );
    }
  }
}

export function normalizeWorkflowTemplateNodes(
  nodes: WorkflowTemplateNodeDto[],
): WorkflowTemplateNodeDto[] {
  return [...nodes]
    .sort((left, right) => left.nodeOrder - right.nodeOrder)
    .map((node, index) => ({
      ...node,
      nodeOrder: index + 1,
    }));
}
