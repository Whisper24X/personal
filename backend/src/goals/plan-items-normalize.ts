import { BadRequestException } from '@nestjs/common';
import { buildPlanItemAdjacency, directedGraphHasCycle } from './goal-plan-dag';

/** 子任务（Agent 输出规范化后） */
export type NormalizedPlanSubTaskFromAgent = {
  subLocalId: string;
  title: string;
  summary?: string;
  acceptanceCriteria?: string;
  suggestedPrompt?: string;
  dependsOnSubLocalIds: string[];
};

/** 顶层功能组 + 子任务 */
export type NormalizedPlanItemFromAgent = {
  localId: string;
  title: string;
  summary?: string;
  acceptanceCriteria?: string;
  suggestedPrompt?: string;
  dependsOnLocalIds: string[];
  subTasks: NormalizedPlanSubTaskFromAgent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickFirstNonEmptyString(
  o: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (v === undefined || v === null) {
      continue;
    }
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) {
        return t;
      }
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return String(v);
    }
  }
  return undefined;
}

function optionalTrimmedString(
  o: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) {
        return t;
      }
    }
  }
  return undefined;
}

function optionalTextFieldStringOrArray(
  o: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) {
        return t;
      }
    }
    if (Array.isArray(v)) {
      const joined = v
        .map((x) =>
          typeof x === 'string'
            ? x.trim()
            : typeof x === 'number' && Number.isFinite(x)
              ? String(x)
              : '',
        )
        .filter(Boolean)
        .join('；');
      if (joined) {
        return joined;
      }
    }
  }
  return undefined;
}

function normalizeDependsArray(raw: unknown): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === 'string') {
      const t = x.trim();
      if (t) {
        out.push(t);
      }
    } else if (typeof x === 'number' && Number.isFinite(x)) {
      out.push(String(x));
    }
  }
  return out;
}

function normalizeSubTaskFromRaw(
  raw: unknown,
  itemIndex: number,
  subIndex: number,
): NormalizedPlanSubTaskFromAgent {
  if (!isRecord(raw)) {
    throw new BadRequestException(
      `计划项 items[${itemIndex}].subTasks[${subIndex}] 不是对象`,
    );
  }
  const subLocalId = pickFirstNonEmptyString(raw, [
    'subLocalId',
    'sub_local_id',
    'localId',
    'id',
  ]);
  const title = pickFirstNonEmptyString(raw, [
    'title',
    'name',
    'taskTitle',
    'task_title',
  ]);
  if (!subLocalId || !title) {
    throw new BadRequestException(
      `items[${itemIndex}].subTasks[${subIndex}] 缺少 subLocalId 或 title`,
    );
  }
  const dependsOnSubLocalIds = normalizeDependsArray(
    raw.dependsOnSubLocalIds ??
      raw.depends_on_sub_local_ids ??
      raw.dependsOnLocalIds,
  );
  return {
    subLocalId,
    title,
    summary: optionalTrimmedString(raw, [
      'summary',
      'description',
      'overview',
      'brief',
    ]),
    acceptanceCriteria: optionalTextFieldStringOrArray(raw, [
      'acceptanceCriteria',
      'acceptance_criteria',
      'acceptance',
      'criteria',
    ]),
    suggestedPrompt: optionalTrimmedString(raw, [
      'suggestedPrompt',
      'suggested_prompt',
      'prompt',
      'executionPrompt',
      'execution_prompt',
      'agentPrompt',
      'agent_prompt',
    ]),
    dependsOnSubLocalIds,
  };
}

/**
 * 将 Agent 返回的 items 规范为平台字段（含双层 subTasks）。
 */
export function normalizePlanItemsFromAgent(
  items: unknown,
): NormalizedPlanItemFromAgent[] {
  if (!Array.isArray(items)) {
    throw new BadRequestException('items 必须是数组');
  }
  if (items.length === 0) {
    throw new BadRequestException('items 不能为空');
  }

  const out: NormalizedPlanItemFromAgent[] = [];

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    if (!isRecord(raw)) {
      throw new BadRequestException(
        `计划项 items[${i}] 不是对象（每项需含 localId、title、subTasks）`,
      );
    }

    const localId = pickFirstNonEmptyString(raw, ['localId', 'local_id', 'id']);
    const title = pickFirstNonEmptyString(raw, [
      'title',
      'name',
      'taskTitle',
      'task_title',
    ]);

    if (!localId || !title) {
      throw new BadRequestException(
        `计划项 items[${i}] 缺少可用的 localId 或 title`,
      );
    }

    const subRaw = raw.subTasks ?? raw.sub_tasks;
    if (!Array.isArray(subRaw) || subRaw.length === 0) {
      throw new BadRequestException(
        `计划项 items[${i}] 须包含非空 subTasks 数组`,
      );
    }

    const subTasks: NormalizedPlanSubTaskFromAgent[] = [];
    for (let j = 0; j < subRaw.length; j++) {
      subTasks.push(normalizeSubTaskFromRaw(subRaw[j], i, j));
    }

    const dependsOnLocalIds = normalizeDependsArray(
      raw.dependsOnLocalIds ?? raw.depends_on_local_ids ?? raw.dependsOn,
    );

    out.push({
      localId,
      title,
      summary: optionalTrimmedString(raw, [
        'summary',
        'description',
        'overview',
        'brief',
      ]),
      acceptanceCriteria: optionalTextFieldStringOrArray(raw, [
        'acceptanceCriteria',
        'acceptance_criteria',
        'acceptance',
        'criteria',
      ]),
      suggestedPrompt: optionalTrimmedString(raw, [
        'suggestedPrompt',
        'suggested_prompt',
        'prompt',
        'executionPrompt',
        'execution_prompt',
        'agentPrompt',
        'agent_prompt',
      ]),
      dependsOnLocalIds,
      subTasks,
    });
  }

  validateSubLocalIdsUniqueAndRefs(out);
  validateSubtaskGraphNoCycle(out);
  validateParentItemGraphNoCycle(out);

  return out;
}

function validateParentItemGraphNoCycle(items: NormalizedPlanItemFromAgent[]) {
  const localToUuid = new Map<string, string>();
  for (const it of items) {
    localToUuid.set(it.localId, it.localId);
  }
  const pseudo = items.map((it) => ({
    id: it.localId,
    dependsOnItemIds: it.dependsOnLocalIds.filter((lid) =>
      localToUuid.has(lid),
    ),
  }));
  const idSet = new Set(pseudo.map((p) => p.id));
  const adj = buildPlanItemAdjacency(pseudo);
  if (directedGraphHasCycle(idSet, adj)) {
    throw new BadRequestException('顶层功能组 dependsOnLocalIds 存在环');
  }
}

function validateSubLocalIdsUniqueAndRefs(
  items: NormalizedPlanItemFromAgent[],
) {
  const seen = new Set<string>();
  const allIds = new Set<string>();
  for (const it of items) {
    for (const st of it.subTasks) {
      if (seen.has(st.subLocalId)) {
        throw new BadRequestException(
          `子任务 subLocalId 重复: ${st.subLocalId}（须全局唯一）`,
        );
      }
      seen.add(st.subLocalId);
      allIds.add(st.subLocalId);
    }
  }
  for (const it of items) {
    for (const st of it.subTasks) {
      for (const dep of st.dependsOnSubLocalIds) {
        if (!allIds.has(dep)) {
          throw new BadRequestException(
            `子任务 ${st.subLocalId} 依赖未知 subLocalId: ${dep}`,
          );
        }
        if (dep === st.subLocalId) {
          throw new BadRequestException(`子任务 ${st.subLocalId} 不能依赖自身`);
        }
      }
    }
  }
}

function validateSubtaskGraphNoCycle(items: NormalizedPlanItemFromAgent[]) {
  const flat: { id: string; dependsOnItemIds: string[] }[] = [];
  for (const it of items) {
    for (const st of it.subTasks) {
      flat.push({
        id: st.subLocalId,
        dependsOnItemIds: st.dependsOnSubLocalIds,
      });
    }
  }
  const idSet = new Set(flat.map((x) => x.id));
  const adj = buildPlanItemAdjacency(flat);
  if (directedGraphHasCycle(idSet, adj)) {
    throw new BadRequestException('子任务 dependsOnSubLocalIds 存在环');
  }
}

const PARENT_TEXT_KEYS = [
  'summary',
  'acceptanceCriteria',
  'suggestedPrompt',
] as const;

const SUB_TEXT_KEYS = [
  'summary',
  'acceptanceCriteria',
  'suggestedPrompt',
] as const;

/**
 * 若任一项顶层或子任务缺少非空 summary / acceptanceCriteria / suggestedPrompt，返回首个缺口。
 */
export function findFirstMissingPlanItemTextField(
  items: NormalizedPlanItemFromAgent[],
):
  | { kind: 'parent'; index: number; field: (typeof PARENT_TEXT_KEYS)[number] }
  | {
      kind: 'subtask';
      itemIndex: number;
      subIndex: number;
      field: (typeof SUB_TEXT_KEYS)[number];
    }
  | null {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    for (const field of PARENT_TEXT_KEYS) {
      const v = it[field];
      if (typeof v !== 'string' || !v.trim()) {
        return { kind: 'parent', index: i, field };
      }
    }
    for (let j = 0; j < it.subTasks.length; j++) {
      const st = it.subTasks[j];
      for (const field of SUB_TEXT_KEYS) {
        const v = st[field];
        if (typeof v !== 'string' || !v.trim()) {
          return { kind: 'subtask', itemIndex: i, subIndex: j, field };
        }
      }
    }
  }
  return null;
}
