#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

function usage() {
  console.error(
    'Usage:\n  node generate-report.mjs plan <parsed.json> <smoke|full> <output-plan.json>\n  node generate-report.mjs summary <parsed.json> <smoke-result.json> <full-result.json> <output.md>',
  );
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(path.resolve(filePath), 'utf-8'));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(filePath, data) {
  const outputPath = path.resolve(filePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

async function writeText(filePath, content) {
  const outputPath = path.resolve(filePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, 'utf-8');
}

function buildSmokePlan(candidates) {
  const maxEndpoints = Number(process.env.APIFOX_SMOKE_MAX_ENDPOINTS || 4);
  const keywords = String(process.env.APIFOX_SMOKE_KEYWORDS || 'create,save,publish,info,update_status,list')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const score = (ep) => {
    const t = `${ep.method || ''} ${ep.path || ''} ${ep.apiName || ''}`.toLowerCase();
    const i = keywords.findIndex((k) => t.includes(k));
    return i === -1 ? 999 : i;
  };
  const sorted = [...candidates].sort((a, b) => score(a) - score(b));
  const keep = Math.max(maxEndpoints, 1);
  return { planned: sorted.slice(0, keep), skipped: sorted.slice(keep) };
}

function buildPlan(parsed, mode) {
  const candidates = parsed.endpoints.filter((x) => x.changeType === 'added' || x.changeType === 'modified');
  const smoke = buildSmokePlan(candidates);
  return {
    mode,
    generatedAt: new Date().toISOString(),
    featureId: parsed.featureId || 'unknown-feature',
    sourceFile: parsed.sourceFile || '',
    candidateCount: candidates.length,
    plannedCount: mode === 'smoke' ? smoke.planned.length : candidates.length,
    skippedCount: mode === 'smoke' ? smoke.skipped.length : 0,
    planned: mode === 'smoke' ? smoke.planned : candidates,
    skipped: mode === 'smoke' ? smoke.skipped : [],
  };
}

function iconForStatus(status) {
  if (status === 'passed') return 'PASS';
  if (status === 'failed') return 'FAIL';
  if (status === 'skipped') return 'SKIP';
  return 'UNKNOWN';
}

function shortText(value, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function formatDuration(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)}ms` : '';
}

function renderMetricsBlock(metricsSummary) {
  if (!metricsSummary?.metrics) return [];

  const order = [
    'casePassRate',
    'averageResponseTimeMs',
    'p95ResponseTimeMs',
    'dataConsistencyRate',
    'timeoutRate',
    'agentExecutionSuccessRate',
  ];
  const lines = [
    '## 评估指标',
    '',
    `- 综合得分: ${metricsSummary.weightedScore ?? 'N/A'}`,
    `- 系统等级: ${metricsSummary.grade || '不可计算'}`,
    `- 评分说明: ${metricsSummary.scoring?.note || 'N/A'}`,
    '',
    '| 指标 | 指标值 | 等级 | 参与评分 | 公式 |',
    '|------|--------|------|----------|------|',
  ];

  for (const key of order) {
    const item = metricsSummary.metrics[key];
    if (!item) continue;
    lines.push(
      `| ${item.name || key} | ${item.displayValue || 'N/A'} | ${item.level || '不可计算'} | ${item.includedInScore ? '是' : '否'} | ${item.formula || ''} |`,
    );
  }
  lines.push('');

  const skipped = Array.isArray(metricsSummary.scoring?.skippedMetrics) ? metricsSummary.scoring.skippedMetrics : [];
  if (skipped.length > 0) {
    lines.push('### 不可计算项', '');
    for (const item of skipped) {
      lines.push(`- ${item.name}: ${item.reason || '不可计算'}`);
    }
    lines.push('');
  }

  return lines;
}

function renderRunBlock(title, result) {
  const status = result?.status || 'unknown';
  const cases = Array.isArray(result?.cases) ? result.cases : [];
  const lines = [
    `## ${title}`,
    '',
    `- 状态: **${iconForStatus(status)}**`,
    `- 执行目标: ${result?.executionTarget ? `\`${JSON.stringify(result.executionTarget)}\`` : 'N/A'}`,
    `- 计划接口: ${result?.plannedCount ?? 0}`,
    `- 通过/失败: ${result?.passedCount ?? 0}/${result?.failedCount ?? 0}`,
    `- 原始日志: ${result?.logFile ? `\`${result.logFile}\`` : 'N/A'}`,
    '',
  ];

  if (cases.length === 0) {
    lines.push('未执行接口用例。', '');
    return lines;
  }

  lines.push('| 结果 | Method | Path | Auth Channel | Gateway Path | Status | Duration | Timed Out | 说明 |');
  lines.push('|------|--------|------|--------------|--------------|--------|----------|-----------|------|');
  for (const item of cases) {
    const note = item.passed
      ? ''
      : shortText(item.responseBody || item.error || 'request failed');
    lines.push(
      `| ${item.passed ? 'PASS' : 'FAIL'} | ${item.method || ''} | \`${item.path || ''}\` | ${item.authChannel || 'unknown'} | \`${item.gatewayPath || ''}\` | ${item.status ?? ''} | ${formatDuration(item.durationMs)} | ${item.timedOut ? 'YES' : 'NO'} | ${note} |`,
    );
  }
  lines.push('');
  return lines;
}

function renderSummary(parsed, smoke, full, metricsSummary = null) {
  const failedCases = [
    ...(Array.isArray(smoke?.cases) ? smoke.cases.map((item) => ({ ...item, mode: 'smoke' })) : []),
    ...(Array.isArray(full?.cases) ? full.cases.map((item) => ({ ...item, mode: 'full' })) : []),
  ].filter((item) => !item.passed);

  const lines = [
    `# API 自动化测试报告 - ${parsed.featureId || 'unknown-feature'}`,
    '',
    `- 文档来源: \`${parsed.sourceFile || ''}\``,
    `- 文档格式: ${parsed.sourceFormat || 'unknown'}`,
    `- 识别接口: ${parsed.counts?.total ?? 0}（新增 ${parsed.counts?.added ?? 0} / 修改 ${parsed.counts?.modified ?? 0} / 删除 ${parsed.counts?.removed ?? 0}）`,
    '',
    '## 执行结果',
    '',
    `- Smoke: **${iconForStatus(smoke.status || 'unknown')}**`,
    `- Full: **${iconForStatus(full.status || 'unknown')}**`,
    `- 失败用例数: ${failedCases.length}`,
    '',
  ];

  lines.push(...renderMetricsBlock(metricsSummary));
  lines.push(
    '## 识别接口',
    '',
    '| Change | Method | Path | Auth Channel | 名称 |',
    '|--------|--------|------|--------------|------|',
    ...((parsed.endpoints || []).map((item) => (
      `| ${item.changeType || ''} | ${item.method || ''} | \`${item.path || ''}\` | ${item.authChannel || 'unknown'} | ${shortText(item.apiName || item.description || '')} |`
    ))),
    '',
  );

  if (!parsed.endpoints?.length) {
    lines.push('未从文档中识别到可执行接口。', '');
  }

  lines.push(...renderRunBlock('Smoke 明细', smoke));
  lines.push(...renderRunBlock('Full 明细', full));

  if (failedCases.length > 0) {
    lines.push('## 失败摘要', '');
    lines.push('| Mode | Method | Path | Status | Response |');
    lines.push('|------|--------|------|--------|----------|');
    for (const item of failedCases) {
      lines.push(`| ${item.mode} | ${item.method || ''} | \`${item.path || ''}\` | ${item.status ?? ''} | ${shortText(item.responseBody || item.error || '')} |`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  if (cmd === 'plan') {
    const [parsedPath, mode, outputPath] = args;
    if (!parsedPath || !mode || !outputPath) {
      usage();
      process.exit(1);
    }
    await writeJson(outputPath, buildPlan(await readJson(parsedPath), mode));
    return;
  }
  if (cmd === 'summary') {
    const [parsedPath, smokePath, fullPath, outputPath] = args;
    if (!parsedPath || !smokePath || !fullPath || !outputPath) {
      usage();
      process.exit(1);
    }
    const metricsPath = path.join(path.dirname(path.resolve(outputPath)), 'metrics.json');
    await writeText(
      outputPath,
      renderSummary(
        await readJson(parsedPath),
        await readJson(smokePath),
        await readJson(fullPath),
        await readJsonIfExists(metricsPath),
      ),
    );
    return;
  }
  usage();
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
