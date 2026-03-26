import { BadRequestException } from '@nestjs/common';
import {
  findFirstMissingPlanItemTextField,
  normalizePlanItemsFromAgent,
} from './plan-items-normalize';

function sampleItem(overrides: Record<string, unknown> = {}) {
  return {
    localId: 'G1',
    title: '组 A',
    summary: 's',
    acceptanceCriteria: 'ac',
    suggestedPrompt: 'p',
    dependsOnLocalIds: [],
    subTasks: [
      {
        subLocalId: 'T1',
        title: '子1',
        summary: 'a',
        acceptanceCriteria: 'b',
        suggestedPrompt: 'c',
        dependsOnSubLocalIds: [],
      },
    ],
    ...overrides,
  };
}

describe('normalizePlanItemsFromAgent', () => {
  it('should accept two-layer items with subTasks', () => {
    const r = normalizePlanItemsFromAgent([
      sampleItem(),
      {
        ...sampleItem(),
        localId: 'G2',
        subTasks: [
          {
            subLocalId: 'T2',
            title: '子2',
            summary: 'a',
            acceptanceCriteria: 'b',
            suggestedPrompt: 'c',
            dependsOnSubLocalIds: ['T1'],
          },
        ],
      },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].subTasks[0].subLocalId).toBe('T1');
    expect(r[1].subTasks[0].dependsOnSubLocalIds).toEqual(['T1']);
  });

  it('should map id and name to localId and title on parent', () => {
    const r = normalizePlanItemsFromAgent([
      {
        id: 'FE-001',
        name: '组',
        summary: 's',
        acceptanceCriteria: 'ac',
        suggestedPrompt: 'p',
        dependsOnLocalIds: [],
        subTasks: [
          {
            subLocalId: 'S1',
            title: '子',
            summary: 'a',
            acceptanceCriteria: 'b',
            suggestedPrompt: 'c',
            dependsOnSubLocalIds: [],
          },
        ],
      },
    ]);
    expect(r[0].localId).toBe('FE-001');
    expect(r[0].title).toBe('组');
  });

  it('should throw when subTasks missing', () => {
    expect(() =>
      normalizePlanItemsFromAgent([
        {
          localId: 'a',
          title: 't',
          summary: 's',
          acceptanceCriteria: 'ac',
          suggestedPrompt: 'p',
          dependsOnLocalIds: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it('should throw on duplicate subLocalId', () => {
    expect(() =>
      normalizePlanItemsFromAgent([
        {
          localId: 'a',
          title: 't',
          summary: 's',
          acceptanceCriteria: 'ac',
          suggestedPrompt: 'p',
          dependsOnLocalIds: [],
          subTasks: [
            {
              subLocalId: 'X',
              title: '1',
              summary: 'a',
              acceptanceCriteria: 'b',
              suggestedPrompt: 'c',
              dependsOnSubLocalIds: [],
            },
            {
              subLocalId: 'X',
              title: '2',
              summary: 'a',
              acceptanceCriteria: 'b',
              suggestedPrompt: 'c',
              dependsOnSubLocalIds: [],
            },
          ],
        },
      ]),
    ).toThrow(/重复/);
  });
});

describe('findFirstMissingPlanItemTextField', () => {
  it('should return null when all fields present', () => {
    expect(
      findFirstMissingPlanItemTextField([
        {
          localId: 'a',
          title: 't',
          summary: 's',
          acceptanceCriteria: 'ac',
          suggestedPrompt: 'p',
          dependsOnLocalIds: [],
          subTasks: [
            {
              subLocalId: 'x',
              title: 'st',
              summary: 'a',
              acceptanceCriteria: 'b',
              suggestedPrompt: 'c',
              dependsOnSubLocalIds: [],
            },
          ],
        },
      ]),
    ).toBeNull();
  });

  it('should return parent field index', () => {
    expect(
      findFirstMissingPlanItemTextField([
        {
          localId: 'a',
          title: 't',
          summary: '',
          acceptanceCriteria: 'ac',
          suggestedPrompt: 'p',
          dependsOnLocalIds: [],
          subTasks: [
            {
              subLocalId: 'x',
              title: 'st',
              summary: 'a',
              acceptanceCriteria: 'b',
              suggestedPrompt: 'c',
              dependsOnSubLocalIds: [],
            },
          ],
        },
      ]),
    ).toEqual({ kind: 'parent', index: 0, field: 'summary' });
  });
});
