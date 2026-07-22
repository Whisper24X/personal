#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const METHOD_RE = /`(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^`]+)`/i;
const HTTP_METHOD_PATH_BACKTICK_RE = /\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+`(\/[^`]+)`/gi;
const HTTP_INLINE_RE = /\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\/[^\s`,;。）)\]]+)/gi;

function normalizeLegacyChangeType(rawSectionTitle) {
  if (rawSectionTitle.includes('新增接口')) return 'added';
  if (rawSectionTitle.includes('修改接口')) return 'modified';
  if (rawSectionTitle.includes('删除接口')) return 'removed';
  return 'unknown';
}

function normalizeOpenSpecChangeType(rawSectionTitle) {
  if (/ADDED/i.test(rawSectionTitle)) return 'added';
  if (/MODIFIED/i.test(rawSectionTitle)) return 'modified';
  if (/REMOVED/i.test(rawSectionTitle)) return 'removed';
  return 'unknown';
}

function deriveFeatureId(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const changesIdx = parts.indexOf('changes');
  if (changesIdx >= 0 && parts[changesIdx + 1] && parts[changesIdx + 1] !== 'archive') {
    return parts[changesIdx + 1];
  }
  const openspecIdx = parts.indexOf('openspec');
  const specsIdx = openspecIdx >= 0 ? parts.indexOf('specs', openspecIdx) : -1;
  if (specsIdx >= 0 && parts[specsIdx - 1] === 'openspec' && parts[specsIdx + 1]) {
    return parts[specsIdx + 1];
  }
  const featureIdx = parts.lastIndexOf('feature');
  if (featureIdx >= 0 && parts[featureIdx + 1]) return parts[featureIdx + 1];
  return path.basename(path.dirname(filePath)) || 'unknown-feature';
}

function isOpenSpecFormat(content) {
  return /##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/i.test(content);
}

function cleanPath(rawPath) {
  return String(rawPath || '')
    .trim()
    .replace(/[.。,，;；)\]}>]+$/g, '');
}

function extractHttpPairs(text) {
  const pairs = [];
  const seen = new Set();

  const addPair = (method, apiPath) => {
    const normalizedMethod = String(method || '').toUpperCase();
    const normalizedPath = cleanPath(apiPath);
    if (!normalizedMethod || !normalizedPath.startsWith('/')) return;
    const key = `${normalizedMethod} ${normalizedPath}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ method: normalizedMethod, path: normalizedPath });
  };

  const backtickRe = /`(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^`]+)`/gi;
  for (const match of text.matchAll(backtickRe)) {
    addPair(match[1], match[2]);
  }

  for (const match of text.matchAll(HTTP_METHOD_PATH_BACKTICK_RE)) {
    addPair(match[1], match[2]);
  }

  for (const match of text.matchAll(HTTP_INLINE_RE)) {
    addPair(match[1], match[2]);
  }

  return pairs;
}

function parseLegacyMarkdown(content) {
  const lines = content.split(/\r?\n/);
  let section = '';
  let moduleName = '';
  let apiName = '';
  let pending = null;
  const endpoints = [];

  const flush = () => {
    if (!pending) return;
    if (pending.method && pending.path) {
      endpoints.push({
        changeType: pending.changeType,
        module: pending.module,
        apiName: pending.apiName,
        method: pending.method,
        path: pending.path,
        description: pending.description || '',
        auth: pending.auth || '',
      });
    }
    pending = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      flush();
      section = trimmed.replace(/^##\s+/, '');
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flush();
      moduleName = trimmed.replace(/^###\s+/, '');
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      flush();
      apiName = trimmed.replace(/^####\s+/, '');
      continue;
    }
    if (trimmed.includes('| **接口地址** |')) {
      flush();
      const matched = trimmed.match(METHOD_RE);
      pending = {
        changeType: normalizeLegacyChangeType(section),
        module: moduleName,
        apiName,
        method: matched?.[1]?.toUpperCase() ?? '',
        path: matched?.[2]?.trim() ?? '',
        description: '',
        auth: '',
      };
      continue;
    }
    if (!pending) continue;
    if (trimmed.includes('| **接口描述** |')) {
      pending.description = trimmed.replace('| **接口描述** |', '').replace(/\|\s*$/, '').trim();
      continue;
    }
    if (trimmed.includes('| **认证方式** |')) {
      pending.auth = trimmed.replace('| **认证方式** |', '').replace(/\|\s*$/, '').trim();
    }
  }

  flush();
  return endpoints;
}

function parseOpenSpecMarkdown(content) {
  const lines = content.split(/\r?\n/);
  let section = '';
  let requirementName = '';
  let scenarioName = '';
  let requirementLines = [];
  let scenarioLines = [];
  const endpoints = [];
  const endpointKeys = new Set();

  const pushEndpoint = (changeType, module, apiName, method, apiPath, description) => {
    const key = `${changeType}|${method}|${apiPath}`;
    if (endpointKeys.has(key)) return;
    endpointKeys.add(key);
    endpoints.push({
      changeType,
      module,
      apiName,
      method,
      path: apiPath,
      description: description || '',
      auth: '',
    });
  };

  const flushRequirement = () => {
    if (!requirementName) return;
    const requirementText = requirementLines.join('\n');
    const changeType = normalizeOpenSpecChangeType(section);
    for (const pair of extractHttpPairs(requirementText)) {
      pushEndpoint(changeType, 'http-api', requirementName, pair.method, pair.path, requirementText.slice(0, 240));
    }
    requirementName = '';
    requirementLines = [];
  };

  const flushScenario = () => {
    if (!requirementName || !scenarioName) return;
    const scenarioText = scenarioLines.join('\n');
    const changeType = normalizeOpenSpecChangeType(section);
    for (const pair of extractHttpPairs(scenarioText)) {
      pushEndpoint(
        changeType,
        'http-api',
        `${requirementName} / ${scenarioName}`,
        pair.method,
        pair.path,
        scenarioText.slice(0, 240),
      );
    }
    scenarioName = '';
    scenarioLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      flushScenario();
      flushRequirement();
      section = trimmed.replace(/^##\s+/, '');
      continue;
    }
    if (trimmed.startsWith('### Requirement:')) {
      flushScenario();
      flushRequirement();
      requirementName = trimmed.replace(/^###\s+Requirement:\s*/, '').trim();
      continue;
    }
    if (trimmed.startsWith('#### Scenario:')) {
      flushScenario();
      scenarioName = trimmed.replace(/^####\s+Scenario:\s*/, '').trim();
      continue;
    }
    if (scenarioName) {
      scenarioLines.push(line);
      continue;
    }
    if (requirementName) {
      requirementLines.push(line);
    }
  }

  flushScenario();
  flushRequirement();
  return endpoints;
}

function parseMarkdown(content) {
  if (isOpenSpecFormat(content)) {
    return parseOpenSpecMarkdown(content);
  }
  return parseLegacyMarkdown(content);
}

async function main() {
  const [, , inputPathArg, outputPathArg] = process.argv;
  if (!inputPathArg) {
    console.error('Usage: node parse-api-changes.mjs <apiChanges.md|openspec-spec.md> [output.json]');
    process.exit(1);
  }
  const inputPath = path.resolve(inputPathArg);
  const raw = await fs.readFile(inputPath, 'utf-8');
  const endpoints = parseMarkdown(raw);
  const result = {
    sourceFile: inputPath,
    sourceFormat: isOpenSpecFormat(raw) ? 'openspec' : 'legacy-api-changes',
    featureId: deriveFeatureId(inputPath),
    generatedAt: new Date().toISOString(),
    counts: {
      added: endpoints.filter((x) => x.changeType === 'added').length,
      modified: endpoints.filter((x) => x.changeType === 'modified').length,
      removed: endpoints.filter((x) => x.changeType === 'removed').length,
      total: endpoints.length,
    },
    endpoints,
  };
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPathArg) {
    const outputPath = path.resolve(outputPathArg);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, text, 'utf-8');
    return;
  }
  process.stdout.write(text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
