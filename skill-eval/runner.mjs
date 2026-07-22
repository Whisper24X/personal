#!/usr/bin/env node
/**
 * skill-eval —— 评测 Cursor skills / subagent 的可复用 harness
 *
 * 用法:
 *   node runner.mjs                      # 跑 cases/ 下所有 *.case.json
 *   node runner.mjs cases/xxx.case.json  # 跑单个 case
 *   node runner.mjs --filter prd         # 只跑 id/标题含 "prd" 的 case
 *   node runner.mjs --dry-run            # 只校验 case 格式与 prompt 组装，不调用 agent
 *
 * 环境变量:
 *   CURSOR_API_KEY        cursor-agent 鉴权（必填，除非 mock/dry-run）
 *   CURSOR_MODEL          默认模型（case 内可覆盖），默认 auto
 *   SKILL_EVAL_MOCK_DIR   设置后用 <dir>/<caseId>.txt 作为 agent 输出（离线验证 harness）
 *   SKILL_EVAL_JUDGE_MODEL judge 用的模型，默认同 CURSOR_MODEL
 *
 * 退出码: 全部通过=0，有失败=1，运行错误=2
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// ---------- 工具 ----------
const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};

function loadDotEnv() {
  // 简易 .env 加载：依次找 skill-eval/.env、上级 ainative-skill/.env
  const candidates = [join(ROOT, '.env'), resolve(ROOT, '..', 'ainative-skill', '.env')];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

function absFromCase(caseDir, p) {
  return isAbsolute(p) ? p : resolve(caseDir, p);
}

// ---------- 调用 cursor-agent ----------
/**
 * @returns {{ output:string, latencyMs:number, exitCode:number, workspace:string }}
 */
function runAgent({ prompt, model, timeoutMs, pluginDir, fixtures, caseDir, caseId, dryRun }) {
  // 每个 case 独立工作区，避免文件改动互相污染
  const workspace = mkdtempSync(join(tmpdir(), `skilleval-${caseId}-`));
  for (const f of fixtures || []) {
    const src = absFromCase(caseDir, f.from);
    const dst = join(workspace, f.to || basename(f.from));
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: true });
  }

  if (dryRun) {
    return { output: '[dry-run] prompt 已组装，未调用 agent', latencyMs: 0, exitCode: 0, workspace };
  }

  // mock：离线验证 harness
  const mockDir = process.env.SKILL_EVAL_MOCK_DIR;
  if (mockDir) {
    const mockFile = join(mockDir, `${caseId}.txt`);
    const output = existsSync(mockFile) ? readFileSync(mockFile, 'utf8') : '[mock] 缺少 mock 输出文件';
    return { output, latencyMs: 0, exitCode: 0, workspace };
  }

  const args = ['--print', '--output-format', 'text', '--force', '--trust', '--workspace', workspace];
  if (model) args.push('--model', model);
  if (pluginDir) args.push('--plugin-dir', absFromCase(caseDir, pluginDir));
  args.push(prompt);

  const t0 = Date.now();
  const res = spawnSync('cursor-agent', args, {
    cwd: workspace,
    encoding: 'utf8',
    timeout: timeoutMs || 300000,
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
  const latencyMs = Date.now() - t0;
  if (res.error) {
    return { output: `[agent error] ${res.error.message}\n${res.stderr || ''}`, latencyMs, exitCode: 1, workspace };
  }
  return { output: (res.stdout || '').trim(), latencyMs, exitCode: res.status ?? 0, workspace };
}

// ---------- 断言引擎 ----------
function judge({ output, rubric, model }) {
  const prompt = `你是严格的评测裁判。下面是【被测输出】和【评分标准】。
请只输出一个 JSON 对象，形如 {"score": 0.0-1.0, "pass": true/false, "reason": "简短理由"}，不要输出其它内容。

【评分标准】
${rubric}

【被测输出】
${output}`;

  const mockDir = process.env.SKILL_EVAL_MOCK_DIR;
  let raw;
  if (mockDir) {
    // mock 模式下，judge 给满分以验证流程
    raw = '{"score": 1, "pass": true, "reason": "mock judge"}';
  } else {
    const res = spawnSync('cursor-agent', ['--print', '--output-format', 'text', '--model', model, prompt], {
      encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024, env: process.env,
    });
    raw = (res.stdout || '').trim();
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { score: 0, pass: false, reason: `judge 输出无法解析: ${raw.slice(0, 120)}` };
  try {
    const j = JSON.parse(m[0]);
    return { score: Number(j.score) || 0, pass: !!j.pass, reason: j.reason || '' };
  } catch {
    return { score: 0, pass: false, reason: `judge JSON 解析失败: ${m[0].slice(0, 120)}` };
  }
}

function checkAssertion(a, ctx) {
  const { output, latencyMs, workspace, judgeModel } = ctx;
  switch (a.type) {
    case 'contains':
      return { pass: output.includes(a.value), detail: `应包含 "${a.value}"` };
    case 'icontains':
      return { pass: output.toLowerCase().includes(String(a.value).toLowerCase()), detail: `应包含(忽略大小写) "${a.value}"` };
    case 'not_contains':
      return { pass: !output.includes(a.value), detail: `不应包含 "${a.value}"` };
    case 'regex':
      return { pass: new RegExp(a.value, a.flags || '').test(output), detail: `应匹配 /${a.value}/${a.flags || ''}` };
    case 'file_exists':
      return { pass: existsSync(join(workspace, a.value)), detail: `应生成文件 ${a.value}` };
    case 'max_latency_ms':
      return { pass: latencyMs <= a.value, detail: `耗时应 ≤ ${a.value}ms (实际 ${latencyMs}ms)` };
    case 'judge': {
      const j = judge({ output, rubric: a.rubric, model: judgeModel });
      const passScore = a.passScore ?? 0.8;
      return { pass: j.score >= passScore && j.pass !== false, detail: `judge ≥ ${passScore} (得分 ${j.score}: ${j.reason})` };
    }
    default:
      return { pass: false, detail: `未知断言类型: ${a.type}` };
  }
}

// ---------- 单 case ----------
function runCase(casePath, opts) {
  const caseDir = dirname(casePath);
  const spec = JSON.parse(readFileSync(casePath, 'utf8'));
  const caseId = spec.id || basename(casePath).replace(/\.case\.json$/, '');
  const model = spec.model || process.env.CURSOR_MODEL || 'auto';
  const judgeModel = process.env.SKILL_EVAL_JUDGE_MODEL || model;

  // 组装 prompt：可选注入 SKILL.md
  let prompt = spec.prompt;
  if (spec.promptFile) prompt = readFileSync(absFromCase(caseDir, spec.promptFile), 'utf8');
  if (spec.injectSkill) {
    const skillContent = readFileSync(absFromCase(caseDir, spec.injectSkill), 'utf8');
    prompt = `请严格遵循以下技能规范完成任务，直接输出结果，不要说"已保存到文件"之类的话。\n\n=== 技能规范(SKILL.md) ===\n${skillContent}\n\n=== 任务 ===\n${prompt}`;
  }

  const started = new Date();
  const { output, latencyMs, exitCode, workspace } = runAgent({
    prompt, model, timeoutMs: spec.timeoutMs, pluginDir: spec.pluginDir,
    fixtures: spec.fixtures, caseDir, caseId, dryRun: opts.dryRun,
  });

  const ctx = { output, latencyMs, workspace, judgeModel };
  const results = opts.dryRun
    ? []
    : (spec.assertions || []).map((a) => ({ ...a, ...checkAssertion(a, ctx) }));

  const passed = results.every((r) => r.pass);
  // 清理临时工作区（保留报告内的关键信息）
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}

  return {
    id: caseId,
    title: spec.title || caseId,
    skill: spec.skill || '-',
    model,
    passed: opts.dryRun ? null : passed,
    latencyMs,
    exitCode,
    assertions: results,
    output: output.slice(0, 4000),
    startedAt: started.toISOString(),
  };
}

// ---------- main ----------
function main() {
  loadDotEnv();
  const argv = process.argv.slice(2);
  const opts = { dryRun: argv.includes('--dry-run') };
  const filterIdx = argv.indexOf('--filter');
  const filter = filterIdx >= 0 ? argv[filterIdx + 1] : null;
  const explicit = argv.filter((a) => a.endsWith('.case.json'));

  let casePaths;
  if (explicit.length) {
    casePaths = explicit.map((p) => resolve(p));
  } else {
    const dir = join(ROOT, 'cases');
    casePaths = readdirSync(dir).filter((f) => f.endsWith('.case.json')).map((f) => join(dir, f));
  }
  if (filter) casePaths = casePaths.filter((p) => basename(p).includes(filter));

  if (!casePaths.length) {
    console.error(C.r('没有匹配的 case'));
    process.exit(2);
  }

  console.log(C.b(`\n🧪 skill-eval：共 ${casePaths.length} 个 case${opts.dryRun ? ' (dry-run)' : ''}\n`));
  const reports = [];
  for (const p of casePaths) {
    process.stdout.write(`▶ ${basename(p)} ... `);
    let rep;
    try {
      rep = runCase(p, opts);
    } catch (e) {
      console.log(C.r('运行错误'));
      console.log('  ' + C.dim(e.message));
      reports.push({ id: basename(p), passed: false, error: e.message });
      continue;
    }
    if (opts.dryRun) {
      console.log(C.y('组装 OK'));
    } else {
      console.log(rep.passed ? C.g(`PASS (${rep.latencyMs}ms)`) : C.r(`FAIL (${rep.latencyMs}ms)`));
      for (const a of rep.assertions) {
        console.log('   ' + (a.pass ? C.g('✓') : C.r('✗')) + ' ' + C.dim(`[${a.type}] ${a.detail}`));
      }
    }
    reports.push(rep);
  }

  // 写报告
  if (!opts.dryRun) {
    mkdirSync(join(ROOT, 'reports'), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = join(ROOT, 'reports', `report-${stamp}.json`);
    writeFileSync(out, JSON.stringify(reports, null, 2));
    const pass = reports.filter((r) => r.passed).length;
    const fail = reports.length - pass;
    console.log(C.b(`\n📊 结果: ${C.g(pass + ' passed')}, ${fail ? C.r(fail + ' failed') : '0 failed'}`));
    console.log(C.dim(`   报告: ${out}\n`));
    process.exit(fail ? 1 : 0);
  }
}

main();
