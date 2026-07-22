#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const METRIC_WEIGHTS = {
  casePassRate: 0.25,
  averageResponseTimeMs: 0.15,
  p95ResponseTimeMs: 0.15,
  dataConsistencyRate: 0.25,
  timeoutRate: 0.10,
  agentExecutionSuccessRate: 0.10,
};

const LEVEL_SCORE = {
  '优秀': 100,
  '良好': 85,
  '待优化': 60,
};

function usage() {
  console.error('Usage:\n  node calculate-metrics.mjs <reportDir> [output.json]');
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function percent(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function ms(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return `${Math.round(value)}ms`;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function p95(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(Math.ceil(sorted.length * 0.95) - 1, 0);
  return sorted[index];
}

function levelForHighRate(value, excellent, good) {
  if (value >= excellent) return '优秀';
  if (value >= good) return '良好';
  return '待优化';
}

function levelForLowRate(value, excellentExclusive, goodInclusive) {
  if (value < excellentExclusive) return '优秀';
  if (value <= goodInclusive) return '良好';
  return '待优化';
}

function levelForAverageResponse(value) {
  if (value <= 300) return '优秀';
  if (value <= 500) return '良好';
  return '待优化';
}

function levelForP95Response(value) {
  if (value <= 500) return '优秀';
  if (value <= 1000) return '良好';
  return '待优化';
}

function gradeForScore(score) {
  if (!Number.isFinite(score)) return '不可计算';
  if (score >= 90) return 'A（优秀）';
  if (score >= 80) return 'B（良好）';
  if (score >= 70) return 'C（合格）';
  return 'D（待优化）';
}

function knownMetric({ key, name, value, displayValue, level, formula, dependsOn }) {
  return {
    name,
    value: round(value),
    displayValue,
    status: 'known',
    level,
    score: LEVEL_SCORE[level] ?? null,
    weight: METRIC_WEIGHTS[key],
    includedInScore: true,
    formula,
    dependsOn,
  };
}

function unavailableMetric({ key, name, status = 'unknown', reason, formula, dependsOn }) {
  return {
    name,
    value: null,
    displayValue: 'N/A',
    status,
    level: '不可计算',
    score: null,
    weight: METRIC_WEIGHTS[key],
    includedInScore: false,
    reason,
    formula,
    dependsOn,
  };
}

function collectCases(results) {
  return results.flatMap((result) => asArray(result?.cases));
}

function collectConsistencyChecks(cases) {
  return cases.flatMap((item) => asArray(item.consistencyChecks).map((check) => ({
    ...check,
    passed: typeof check.passed === 'boolean' ? check.passed : String(check.status || '').toLowerCase() === 'passed',
  })));
}

function calculateKnownWeight(metrics) {
  return Object.values(metrics)
    .filter((item) => item.status === 'known' && item.includedInScore && Number.isFinite(item.score))
    .reduce((sum, item) => sum + item.weight, 0);
}

function calculateWeightedScore(metrics) {
  const known = Object.entries(metrics).filter(([, item]) => (
    item.status === 'known' && item.includedInScore && Number.isFinite(item.score)
  ));
  const knownWeight = calculateKnownWeight(metrics);
  if (known.length === 0 || knownWeight <= 0) return null;
  const score = known.reduce((sum, [, item]) => sum + item.score * (item.weight / knownWeight), 0);
  return round(score, 2);
}

function buildMetrics({ parsed, smoke, full, reportDir }) {
  const results = [smoke, full].filter(Boolean);
  const cases = collectCases(results);
  const durations = cases.map((item) => Number(item.durationMs)).filter((value) => Number.isFinite(value) && value >= 0);
  const consistencyChecks = collectConsistencyChecks(cases);
  const taskResults = results.filter((result) => result?.status);
  const missingInputs = [];

  const metrics = {};

  if (cases.length > 0) {
    const passed = cases.filter((item) => item.passed === true).length;
    const value = passed / cases.length;
    metrics.casePassRate = knownMetric({
      key: 'casePassRate',
      name: '用例通过率',
      value,
      displayValue: percent(value),
      level: levelForHighRate(value, 0.95, 0.90),
      formula: '通过断言数 / 总断言数 × 100%',
      dependsOn: { passedAssertions: passed, totalAssertions: cases.length },
    });

    const timeoutCount = cases.filter((item) => item.timedOut === true).length;
    const timeoutValue = timeoutCount / cases.length;
    metrics.timeoutRate = knownMetric({
      key: 'timeoutRate',
      name: '超时率',
      value: timeoutValue,
      displayValue: percent(timeoutValue),
      level: levelForLowRate(timeoutValue, 0.01, 0.03),
      formula: '超时请求数 / 总请求数 × 100%',
      dependsOn: { timeoutRequestCount: timeoutCount, totalRequestCount: cases.length },
    });
  } else {
    missingInputs.push('cases[]');
    metrics.casePassRate = unavailableMetric({
      key: 'casePassRate',
      name: '用例通过率',
      reason: '未执行接口用例，无法计算通过率',
      formula: '通过断言数 / 总断言数 × 100%',
      dependsOn: { passedAssertions: null, totalAssertions: 0 },
    });
    metrics.timeoutRate = unavailableMetric({
      key: 'timeoutRate',
      name: '超时率',
      reason: '未执行接口请求，无法计算超时率',
      formula: '超时请求数 / 总请求数 × 100%',
      dependsOn: { timeoutRequestCount: null, totalRequestCount: 0 },
    });
  }

  if (durations.length > 0) {
    const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    metrics.averageResponseTimeMs = knownMetric({
      key: 'averageResponseTimeMs',
      name: '平均响应时间',
      value: avg,
      displayValue: ms(avg),
      level: levelForAverageResponse(avg),
      formula: '总响应时间 / 请求总数',
      dependsOn: { totalResponseTimeMs: Math.round(durations.reduce((sum, value) => sum + value, 0)), requestCount: durations.length },
    });

    const p95Value = p95(durations);
    metrics.p95ResponseTimeMs = knownMetric({
      key: 'p95ResponseTimeMs',
      name: 'P95 响应时间',
      value: p95Value,
      displayValue: ms(p95Value),
      level: levelForP95Response(p95Value),
      formula: '第 95 百分位请求耗时',
      dependsOn: { requestDurationsMs: durations.length },
    });
  } else {
    missingInputs.push('cases[].durationMs');
    metrics.averageResponseTimeMs = unavailableMetric({
      key: 'averageResponseTimeMs',
      name: '平均响应时间',
      reason: '结果中缺少请求耗时 durationMs',
      formula: '总响应时间 / 请求总数',
      dependsOn: { totalResponseTimeMs: null, requestCount: 0 },
    });
    metrics.p95ResponseTimeMs = unavailableMetric({
      key: 'p95ResponseTimeMs',
      name: 'P95 响应时间',
      reason: '结果中缺少请求耗时 durationMs',
      formula: '第 95 百分位请求耗时',
      dependsOn: { requestDurationsMs: 0 },
    });
  }

  if (consistencyChecks.length > 0) {
    const passed = consistencyChecks.filter((item) => item.passed === true).length;
    const value = passed / consistencyChecks.length;
    metrics.dataConsistencyRate = knownMetric({
      key: 'dataConsistencyRate',
      name: '数据一致率',
      value,
      displayValue: percent(value),
      level: levelForHighRate(value, 0.999, 0.99),
      formula: '一致校验数 / 总校验数 × 100%',
      dependsOn: { passedConsistencyChecks: passed, totalConsistencyChecks: consistencyChecks.length },
    });
  } else {
    missingInputs.push('cases[].consistencyChecks[]');
    metrics.dataConsistencyRate = unavailableMetric({
      key: 'dataConsistencyRate',
      name: '数据一致率',
      status: 'not_applicable',
      reason: '未提供 consistencyChecks[]，本次不参与综合评分',
      formula: '一致校验数 / 总校验数 × 100%',
      dependsOn: { passedConsistencyChecks: null, totalConsistencyChecks: 0 },
    });
  }

  if (taskResults.length > 0) {
    const successCount = taskResults.filter((item) => item.status === 'passed').length;
    const value = successCount / taskResults.length;
    metrics.agentExecutionSuccessRate = knownMetric({
      key: 'agentExecutionSuccessRate',
      name: 'Agent 执行成功率',
      value,
      displayValue: percent(value),
      level: levelForHighRate(value, 0.95, 0.90),
      formula: '成功完成任务数 / 总任务数 × 100%',
      dependsOn: { successfulTaskCount: successCount, totalTaskCount: taskResults.length },
    });
  } else {
    missingInputs.push('smoke-result.json/full-result.json status');
    metrics.agentExecutionSuccessRate = unavailableMetric({
      key: 'agentExecutionSuccessRate',
      name: 'Agent 执行成功率',
      reason: '缺少任务执行结果状态',
      formula: '成功完成任务数 / 总任务数 × 100%',
      dependsOn: { successfulTaskCount: null, totalTaskCount: 0 },
    });
  }

  const weightedScore = calculateWeightedScore(metrics);
  const knownWeight = calculateKnownWeight(metrics);
  const skippedMetrics = Object.entries(metrics)
    .filter(([, item]) => item.status !== 'known' || !item.includedInScore)
    .map(([key, item]) => ({ key, name: item.name, reason: item.reason || '不可计算' }));

  return {
    schemaVersion: 1,
    featureId: parsed?.featureId || smoke?.featureId || full?.featureId || path.basename(reportDir),
    generatedAt: new Date().toISOString(),
    source: {
      type: 'api-change-auto-test',
      reportDir,
    },
    inputs: {
      parsedApis: parsed ? {
        counts: parsed.counts || null,
        executableEndpointCount: Number(parsed.counts?.added || 0) + Number(parsed.counts?.modified || 0),
      } : null,
      smokeResult: smoke ? {
        status: smoke.status,
        plannedCount: smoke.plannedCount,
        passedCount: smoke.passedCount,
        failedCount: smoke.failedCount,
        caseCount: asArray(smoke.cases).length,
      } : null,
      fullResult: full ? {
        status: full.status,
        plannedCount: full.plannedCount,
        passedCount: full.passedCount,
        failedCount: full.failedCount,
        caseCount: asArray(full.cases).length,
      } : null,
    },
    metrics,
    weightedScore,
    grade: gradeForScore(weightedScore),
    scoring: {
      originalWeights: METRIC_WEIGHTS,
      knownWeight: round(knownWeight, 4),
      reweighted: knownWeight > 0 && knownWeight < 1,
      note: knownWeight > 0 && knownWeight < 1
        ? '不可计算指标未计入综合评分，已对可计算指标按剩余权重重归一化'
        : '全部参与评分的指标使用原始权重计算',
      skippedMetrics,
    },
    scoringNotes: [
      knownWeight > 0 && knownWeight < 1
        ? '不可计算指标未计入综合评分，已对可计算指标按剩余权重重归一化'
        : '全部参与评分的指标使用原始权重计算',
    ],
    missingInputs: [...new Set(missingInputs)],
  };
}

async function main() {
  const [, , reportDirArg, outputPathArg] = process.argv;
  if (!reportDirArg) {
    usage();
    process.exit(1);
  }

  const reportDir = path.resolve(reportDirArg);
  const parsed = await readJsonIfExists(path.join(reportDir, 'parsed-apis.json'));
  const smoke = await readJsonIfExists(path.join(reportDir, 'smoke-result.json'));
  const full = await readJsonIfExists(path.join(reportDir, 'full-result.json'));
  const metrics = buildMetrics({ parsed, smoke, full, reportDir });
  const outputPath = path.resolve(outputPathArg || path.join(reportDir, 'metrics.json'));

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf-8');
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
