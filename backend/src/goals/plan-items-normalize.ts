import { BadRequestException } from '@nestjs/common';

/** Agent 输出经别名与 trim 后的计划项，供 generatePlan 落库 */
export type NormalizedPlanItemFromAgent = {
  localId: string;
  title: string;
  summary?: string;
  acceptanceCriteria?: string;
  suggestedPrompt?: string;
  dependsOnLocalIds: string[];
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

/** 字符串或字符串数组（验收标准等）；数组元素会合并为「；」分隔 */
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

/**
 * 将 Agent 返回的 items 规范为平台字段：支持 id/name 等别名，并对缺项给出带下标的 400。
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
        `计划项 items[${i}] 不是对象（每项需含 localId、title；勿仅用 id/name 作为唯一标识时遗漏映射字段）`,
      );
    }

    const localId = pickFirstNonEmptyString(raw, [
      'localId',
      'local_id',
      'id',
    ]);
    const title = pickFirstNonEmptyString(raw, [
      'title',
      'name',
      'taskTitle',
      'task_title',
    ]);

    if (!localId || !title) {
      throw new BadRequestException(
        `计划项 items[${i}] 缺少可用的 localId 或 title（请使用 localId、title；勿仅用 id/name 代替）`,
      );
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
    });
  }

  return out;
}

const TEXT_FIELD_KEYS = ['summary', 'acceptanceCriteria', 'suggestedPrompt'] as const;

/**
 * 若任一项缺少非空 summary / acceptanceCriteria / suggestedPrompt，返回首个缺口；否则 null。
 * 用于 generatePlan 在模型漏填时触发重试。
 */
export function findFirstMissingPlanItemTextField(
  items: NormalizedPlanItemFromAgent[],
): { index: number; field: (typeof TEXT_FIELD_KEYS)[number] } | null {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    for (const field of TEXT_FIELD_KEYS) {
      const v = it[field];
      if (typeof v !== 'string' || !v.trim()) {
        return { index: i, field };
      }
    }
  }
  return null;
}
