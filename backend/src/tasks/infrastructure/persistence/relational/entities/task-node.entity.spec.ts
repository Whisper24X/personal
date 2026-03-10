import { getMetadataArgsStorage } from 'typeorm';
import { TaskNodeEntity } from './task-node.entity';

describe('TaskNodeEntity', () => {
  it('should map agent CLI columns to current database names', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === TaskNodeEntity,
    );

    expect(
      columns.find((column) => column.propertyName === 'agentCliId')?.options
        .name,
    ).toBe('agentCliId');
    expect(
      columns.find((column) => column.propertyName === 'agentCliConfigId')
        ?.options.name,
    ).toBe('agentCliConfigId');
    expect(
      columns.find((column) => column.propertyName === 'agentClioutput')
        ?.options.name,
    ).toBe('agentClioutput');
    expect(
      columns.find((column) => column.propertyName === 'agentCliSessionId')
        ?.options.name,
    ).toBe('agentCliSessionId');
  });
});
