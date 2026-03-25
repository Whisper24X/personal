import { BadRequestException } from '@nestjs/common';
import {
  findFirstMissingPlanItemTextField,
  normalizePlanItemsFromAgent,
} from './plan-items-normalize';

describe('normalizePlanItemsFromAgent', () => {
  it('accepts canonical localId and title', () => {
    const r = normalizePlanItemsFromAgent([
      {
        localId: 'A',
        title: 'T1',
        dependsOnLocalIds: [],
      },
    ]);
    expect(r).toEqual([
      {
        localId: 'A',
        title: 'T1',
        dependsOnLocalIds: [],
      },
    ]);
  });

  it('maps id and name to localId and title', () => {
    const r = normalizePlanItemsFromAgent([
      { id: 'FE-001', name: '登录页' },
      {
        local_id: 'FE-002',
        task_title: '接口',
        summary: 'x',
      },
    ]);
    expect(r[0].localId).toBe('FE-001');
    expect(r[0].title).toBe('登录页');
    expect(r[1].localId).toBe('FE-002');
    expect(r[1].title).toBe('接口');
    expect(r[1].summary).toBe('x');
  });

  it('trims localId and title', () => {
    const r = normalizePlanItemsFromAgent([
      { localId: '  a  ', title: '  b  ' },
    ]);
    expect(r[0].localId).toBe('a');
    expect(r[0].title).toBe('b');
  });

  it('normalizes dependsOnLocalIds aliases', () => {
    const r = normalizePlanItemsFromAgent([
      {
        localId: 'B',
        title: 't',
        depends_on_local_ids: [' A ', 2],
      },
    ]);
    expect(r[0].dependsOnLocalIds).toEqual(['A', '2']);
  });

  it('throws BadRequest with index when title missing', () => {
    expect(() => normalizePlanItemsFromAgent([{ localId: 'x' }])).toThrow(
      /items\[0\].*localId 或 title/,
    );
  });

  it('throws when items is not an array', () => {
    expect(() => normalizePlanItemsFromAgent({})).toThrow(BadRequestException);
  });

  it('throws when items is empty', () => {
    expect(() => normalizePlanItemsFromAgent([])).toThrow(BadRequestException);
  });

  it('joins acceptanceCriteria from string array alias acceptance', () => {
    const r = normalizePlanItemsFromAgent([
      {
        localId: 'a',
        title: 't',
        summary: 's',
        suggestedPrompt: 'p',
        acceptance: ['标准一', '标准二'],
        dependsOnLocalIds: [],
      },
    ]);
    expect(r[0].acceptanceCriteria).toBe('标准一；标准二');
  });
});

describe('findFirstMissingPlanItemTextField', () => {
  it('returns null when summary, acceptanceCriteria, suggestedPrompt are non-empty', () => {
    expect(
      findFirstMissingPlanItemTextField([
        {
          localId: 'a',
          title: 't',
          summary: 's',
          acceptanceCriteria: 'ac',
          suggestedPrompt: 'p',
          dependsOnLocalIds: [],
        },
      ]),
    ).toBeNull();
  });

  it('returns first missing field index', () => {
    expect(
      findFirstMissingPlanItemTextField([
        {
          localId: 'a',
          title: 't',
          summary: '',
          acceptanceCriteria: 'ac',
          suggestedPrompt: 'p',
          dependsOnLocalIds: [],
        },
      ]),
    ).toEqual({ index: 0, field: 'summary' });
  });
});
