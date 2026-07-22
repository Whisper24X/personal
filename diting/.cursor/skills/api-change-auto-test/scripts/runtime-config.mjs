#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const SKILL_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export function getWorkspaceRoot() {
  return path.resolve(process.env.SKILL_WORKSPACE_ROOT || process.cwd());
}

const RUNTIME_CANDIDATES = [
  { kind: 'runtime', path: path.join(SKILL_ROOT, 'api-test/runtime.json') },
  { kind: 'runtime', rel: 'skills/api-change-auto-test/api-test/runtime.json' },
  { kind: 'runtime', rel: '.cursor/skills/api-change-auto-test/api-test/runtime.json' },
  { kind: 'runtime', rel: 'api-test/runtime.json' },
  { kind: 'legacy-auth', rel: 'api-test/api-auth.json' },
];

export async function loadRuntimeConfig(workspaceRoot = getWorkspaceRoot()) {
  for (const candidate of RUNTIME_CANDIDATES) {
    const abs = candidate.path || path.join(workspaceRoot, candidate.rel);
    try {
      const raw = JSON.parse(await fs.readFile(abs, 'utf-8'));
      if (candidate.kind === 'legacy-auth') {
        return normalizeRuntime({ auth: raw });
      }
      return normalizeRuntime(raw);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
  return normalizeRuntime({});
}

function normalizeRuntime(raw) {
  const auth = raw.auth || {};
  const channels = auth.channels || {
    admin: { headerEnv: 'RUNNER_ADMIN_AUTH_HEADER', legacyHeaderEnvs: ['RUNNER_SHADOW_AUTH_HEADER'] },
    client: { headerEnv: 'RUNNER_CLIENT_AUTH_HEADER', legacyHeaderEnvs: ['RUNNER_WECHAT_AUTH_HEADER'] },
  };
  for (const key of Object.keys(channels)) {
    const ch = channels[key] || {};
    if (!ch.headerEnv && key === 'admin') ch.headerEnv = 'RUNNER_ADMIN_AUTH_HEADER';
    if (!ch.headerEnv && key === 'client') ch.headerEnv = 'RUNNER_CLIENT_AUTH_HEADER';
    if (!Array.isArray(ch.legacyHeaderEnvs)) ch.legacyHeaderEnvs = [];
    channels[key] = ch;
  }
  return {
    auth: {
      channels,
      classify: Array.isArray(auth.classify) ? auth.classify : [],
    },
    backend: raw.backend || null,
  };
}

function normalizePathForMatch(apiPath) {
  const input = String(apiPath || '').trim();
  if (/^https?:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      return `${u.pathname || '/'}${u.search || ''}`;
    } catch {
      return input;
    }
  }
  return input.startsWith('/') ? input : `/${input}`;
}

function moduleHintsChannel(moduleName) {
  const m = String(moduleName || '').toLowerCase();
  if (/管理|后台|shadow|admin|b端/.test(m)) return 'admin';
  if (/学生|客户端|wechat|client|c端|mobile/.test(m)) return 'client';
  return null;
}

export function classifyEndpoint(endpoint, runtime) {
  const apiPath = normalizePathForMatch(endpoint?.path || '');
  const rules = runtime?.auth?.classify || [];

  for (const rule of rules) {
    const channel = rule.channel;
    if (!channel) continue;
    if (rule.pathPrefix && apiPath.startsWith(String(rule.pathPrefix))) return channel;
    if (rule.pathRegex) {
      try {
        if (new RegExp(rule.pathRegex).test(apiPath)) return channel;
      } catch {
        // ignore invalid regex
      }
    }
    if (rule.moduleContains) {
      const moduleName = String(endpoint?.module || endpoint?.apiName || '');
      if (moduleName.includes(String(rule.moduleContains))) return channel;
    }
  }

  const fromModule = moduleHintsChannel(endpoint?.module || endpoint?.apiName || '');
  if (fromModule) return fromModule;

  return 'unknown';
}

export function parseDotEnvLines(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const idx = normalized.indexOf('=');
    if (idx <= 0) continue;
    const key = normalized.slice(0, idx).trim();
    let value = normalized.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export async function loadEnvFileMap(workspaceRoot = getWorkspaceRoot()) {
  const candidates = [
    path.join(workspaceRoot, '.cursor/skills/api-change-auto-test/.env.local'),
    path.join(workspaceRoot, 'skills/api-change-auto-test/.env.local'),
    path.join(SKILL_ROOT, '.env.local'),
  ];
  const merged = {};
  for (const filePath of candidates) {
    try {
      Object.assign(merged, parseDotEnvLines(await fs.readFile(filePath, 'utf-8')));
    } catch {
      // optional file
    }
  }
  return merged;
}

export function resolveHeaderValue(channel, runtime, envMap = process.env) {
  const cfg = runtime?.auth?.channels?.[channel];
  if (!cfg) return '';
  const keys = [cfg.headerEnv, ...(cfg.legacyHeaderEnvs || [])].filter(Boolean);
  for (const key of keys) {
    const fromEnv = String(envMap[key] || '').trim();
    if (fromEnv) return fromEnv;
  }
  return '';
}

export function headersForEndpoint(endpoint, runtime, envMap = process.env) {
  const h = ['Accept: application/json', 'Content-Type: application/json'];
  const channel = classifyEndpoint(endpoint, runtime);
  if (channel === 'unknown') return h;
  const header = resolveHeaderValue(channel, runtime, envMap);
  if (header) h.push(header);
  return h;
}

export function defaultPostBody(method) {
  if (String(method || '').toUpperCase() !== 'POST') return null;
  return { page: 1, pageSize: 10 };
}

export function aggregateAuthProfiles(endpoints, runtime) {
  const profiles = new Set();
  for (const ep of endpoints || []) {
    const channel = classifyEndpoint(ep, runtime);
    if (channel === 'admin' || channel === 'client') profiles.add(channel);
  }
  return [...profiles];
}

export function checkAuthForProfiles(profiles, runtime, envMap) {
  const missing = [];
  for (const channel of profiles) {
    if (!resolveHeaderValue(channel, runtime, envMap)) {
      const headerEnv = runtime?.auth?.channels?.[channel]?.headerEnv || channel;
      missing.push({ channel, headerEnv });
    }
  }
  return {
    authReady: missing.length === 0,
    authProfiles: profiles,
    missing,
  };
}

async function resolveOpenSpecFile(workspaceRoot, changeId) {
  const candidates = [
    path.join(workspaceRoot, 'openspec/specs', changeId, 'spec.md'),
    path.join(workspaceRoot, 'openspec/changes', changeId, 'specs/http-api/spec.md'),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // continue
    }
  }
  const specsDir = path.join(workspaceRoot, 'openspec/changes', changeId, 'specs');
  try {
    const entries = await fs.readdir(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const specPath = path.join(specsDir, entry.name, 'spec.md');
      try {
        await fs.access(specPath);
        return specPath;
      } catch {
        // continue
      }
    }
  } catch {
    // no specs dir
  }
  return null;
}

export async function resolveApiChangesPath(target, workspaceRoot = getWorkspaceRoot()) {
  if (target) {
    if (target.endsWith('.md')) {
      const direct = path.resolve(target);
      try {
        await fs.access(direct);
        return direct;
      } catch {
        const underWorkspace = path.join(workspaceRoot, target);
        await fs.access(underWorkspace);
        return underWorkspace;
      }
    }
    const fromOpenSpec = await resolveOpenSpecFile(workspaceRoot, target);
    if (fromOpenSpec) return fromOpenSpec;
    const legacyCandidates = [
      path.join(workspaceRoot, 'docs/feature', target, 'apiChanges.md'),
      path.join(workspaceRoot, 'tmp', target, 'apiChanges.md'),
      path.join(workspaceRoot, 'tmp/apiChanges.runner.md'),
    ];
    for (const c of legacyCandidates) {
      try {
        await fs.access(c);
        return c;
      } catch {
        // continue
      }
    }
    throw new Error(`Cannot resolve API change document from target: ${target}`);
  }

  const globCandidates = async (pattern) => {
    const root = workspaceRoot;
    const results = [];
    const walk = async (dir, parts) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(next, [...parts, entry.name]);
        } else if (entry.name === 'spec.md' || entry.name === 'apiChanges.md') {
          results.push(next);
        }
      }
    };

    const prefixes = [
      ['openspec', 'changes'],
      ['openspec', 'specs'],
      ['docs', 'feature'],
      ['tmp'],
    ];
    for (const parts of prefixes) {
      const base = path.join(root, ...parts);
      await walk(base, parts);
    }
    const fallback = path.join(root, 'tmp/apiChanges.runner.md');
    try {
      await fs.access(fallback);
      results.push(fallback);
    } catch {
      // no fallback
    }
    if (results.length === 0) return null;
    const stats = await Promise.all(results.map(async (p) => ({ p, mtime: (await fs.stat(p)).mtimeMs })));
    stats.sort((a, b) => b.mtime - a.mtime);
    return stats[0].p;
  };

  const detected = await globCandidates();
  if (!detected) {
    throw new Error('Cannot auto-detect API change document. Pass change-id, feature-id, or file path explicitly.');
  }
  return detected;
}

export function getSkillEnvLocalPath(workspaceRoot = getWorkspaceRoot()) {
  const preferred = path.join(workspaceRoot, '.cursor/skills/api-change-auto-test/.env.local');
  return preferred;
}
