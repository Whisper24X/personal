#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE_ROOT = process.env.AINATIVE_RUNNER_WORKSPACE?.trim() || '/workspace'
const LOG_DIR = path.posix.join(WORKSPACE_ROOT, 'logs')
const LISTEN_PORT = readPositiveNumber(process.env.AINATIVE_RUNNER_LISTEN_PORT) || 8080
const NGINX_CONFIG_PATH = '/etc/nginx/nginx.conf'
const SUPERVISORD_CONFIG_PATH = '/tmp/ainative-runner-supervisord.conf'

const main = async () => {
  const rawInput = await readConfigInput(process.argv[2])
  const orchestration = normalizeRootOrchestration(rawInput)
  const servicesByName = new Map(
    orchestration.services.map((service) => [service.name, service]),
  )

  const bridgeScriptUrl = resolvePreviewBridgeScriptUrlFromEnv()
  await fs.mkdir(LOG_DIR, { recursive: true })
  await Promise.all([
    fs.writeFile(
      NGINX_CONFIG_PATH,
      renderNginxConfig(orchestration, servicesByName, bridgeScriptUrl),
      'utf-8',
    ),
    renderSupervisordConfig(orchestration),
  ])
}

/** 与 TaskPreviewPanel / preview-iframe-bridge.js 协议一致，由主应用经容器环境注入。 */
const resolvePreviewBridgeScriptUrlFromEnv = () => {
  const raw = process.env.AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL?.trim()
  if (!raw) {
    return null
  }
  const off = (process.env.AINATIVE_PREVIEW_BRIDGE_NGINX_INJECT || 'true')
    .trim()
    .toLowerCase()
  if (off === '0' || off === 'false' || off === 'no' || off === 'off') {
    return null
  }
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return null
    }
    return u.href
  } catch {
    return null
  }
}

const readConfigInput = async (configPathArg) => {
  const envJson = process.env.AINATIVE_RUNNER_CONFIG_JSON?.trim()
  if (envJson) {
    return JSON.parse(envJson)
  }

  const configPath = configPathArg?.trim()
  if (configPath) {
    return JSON.parse(await fs.readFile(configPath, 'utf-8'))
  }

  return JSON.parse(
    await fs.readFile(path.posix.join(WORKSPACE_ROOT, 'ainative.runner.json'), 'utf-8'),
  )
}

const normalizeRootOrchestration = (input) => {
  const source = toObjectRecord(input)
  if (!source) {
    throw new Error('Runner orchestration config must be an object')
  }

  const rawOrchestration = toObjectRecord(source.orchestration) ?? source
  const services = Array.isArray(rawOrchestration.services)
    ? rawOrchestration.services.map(normalizeService).filter(Boolean)
    : []
  const routes = Array.isArray(rawOrchestration.routes)
    ? rawOrchestration.routes.map(normalizeRoute).filter(Boolean)
    : []
  const homepage = normalizeHomepage(toObjectRecord(rawOrchestration.homepage))

  return {
    services,
    routes,
    homepage,
  }
}

const normalizeService = (value) => {
  const source = toObjectRecord(value)
  if (!source) {
    return null
  }

  const name = readNonEmptyString(source.name)
  const workdir = readNonEmptyString(source.workdir)
  const command = readNonEmptyString(source.command)
  if (!name || !workdir || !command) {
    return null
  }

  return {
    name,
    workdir,
    command,
    port: readPositiveNumber(source.port),
    env: normalizeStringRecord(toObjectRecord(source.env)),
    installCommand: readNonEmptyString(source.installCommand),
    installCheckPath: readNonEmptyString(source.installCheckPath),
    priority: readPositiveNumber(source.priority) || 100,
    startsecs: readPositiveNumber(source.startsecs) || 10,
    startretries: readPositiveNumber(source.startretries) || 3,
  }
}

const normalizeRoute = (value) => {
  const source = toObjectRecord(value)
  if (!source) {
    return null
  }

  const routePath = readNonEmptyString(source.path)
  if (!routePath) {
    return null
  }

  const action = source.action === 'redirect' ? 'redirect' : 'proxy'
  const match = source.match === 'exact' || source.match === 'regex' ? source.match : 'prefix'

  if (action === 'redirect') {
    const redirectTo = readNonEmptyString(source.redirectTo)
    if (!redirectTo) {
      return null
    }

    return {
      path: routePath,
      action,
      match,
      redirectTo,
      redirectCode: readPositiveNumber(source.redirectCode) || 302,
    }
  }

  const service = readNonEmptyString(source.service)
  if (!service) {
    return null
  }

  return {
    path: routePath,
    action,
    match,
    service,
    targetPort: readPositiveNumber(source.targetPort),
    upstreamPath: readNonEmptyString(source.upstreamPath),
    websocket: source.websocket === true,
  }
}

const normalizeHomepage = (value) => {
  if (!value) {
    return null
  }

  const title = readNonEmptyString(value.title)
  const description = readNonEmptyString(value.description)
  const links = Array.isArray(value.links)
    ? value.links
        .map((item) => {
          const link = toObjectRecord(item)
          const label = readNonEmptyString(link?.label)
          const href = readNonEmptyString(link?.path)
          if (!label || !href) {
            return null
          }
          return { label, path: href }
        })
        .filter(Boolean)
    : []

  if (!title && !description && !links.length) {
    return null
  }

  return {
    title: title || 'AINative Runner',
    description: description || '',
    links,
  }
}

const renderSupervisordConfig = async (orchestration) => {
  const sections = [
    '[supervisord]',
    'nodaemon=true',
    `logfile=${LOG_DIR}/supervisord.log`,
    'logfile_maxbytes=10MB',
    'logfile_backups=1',
    'pidfile=/run/supervisord.pid',
    'user=root',
    '',
    '[unix_http_server]',
    'file=/run/supervisor.sock',
    'chmod=0700',
    '',
    '[rpcinterface:supervisor]',
    'supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface',
    '',
    '[supervisorctl]',
    'serverurl=unix:///run/supervisor.sock',
    '',
    '[program:nginx]',
    'command=/usr/sbin/nginx -g "daemon off;"',
    'autostart=true',
    'autorestart=true',
    'priority=30',
    'redirect_stderr=true',
    `stdout_logfile=${LOG_DIR}/nginx.log`,
    'stdout_logfile_maxbytes=10MB',
    'stdout_logfile_backups=2',
  ]

  for (const service of orchestration.services) {
    const wrapperPath = `/tmp/ainative-runner-service-${sanitizeName(service.name)}.sh`
    await fs.writeFile(wrapperPath, renderServiceWrapper(service), 'utf-8')
    await fs.chmod(wrapperPath, 0o755)

    sections.push(
      '',
      `[program:${sanitizeName(service.name)}]`,
      `command=${wrapperPath}`,
      `directory=${path.posix.join(WORKSPACE_ROOT, trimLeadingSlash(service.workdir))}`,
      `environment=${renderEnvironment(service.env)}`,
      'autostart=true',
      'autorestart=true',
      `startsecs=${service.startsecs}`,
      `startretries=${service.startretries}`,
      `priority=${service.priority}`,
      'redirect_stderr=true',
      `stdout_logfile=${LOG_DIR}/${sanitizeName(service.name)}.log`,
      'stdout_logfile_maxbytes=20MB',
      'stdout_logfile_backups=2',
    )
  }

  sections.push('', '[group:infrastructure]', 'programs=nginx', 'priority=10')

  if (orchestration.services.length) {
    sections.push(
      '',
      '[group:services]',
      `programs=${orchestration.services.map((service) => sanitizeName(service.name)).join(',')}`,
      'priority=100',
    )
  }

  await fs.writeFile(SUPERVISORD_CONFIG_PATH, `${sections.join('\n')}\n`, 'utf-8')
}

const renderServiceWrapper = (service) => {
  const serviceDir = path.posix.join(WORKSPACE_ROOT, trimLeadingSlash(service.workdir))
  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `cd ${shellEscape(serviceDir)}`,
  ]

  if (service.installCommand) {
    if (service.installCheckPath) {
      const checkPath = path.posix.join(serviceDir, trimLeadingSlash(service.installCheckPath))
      lines.push(
        `if [ ! -e ${shellEscape(checkPath)} ]; then`,
        `  ${service.installCommand}`,
        'fi',
      )
    } else {
      lines.push(service.installCommand)
    }
  }

  lines.push(`exec /bin/bash -c ${shellEscape(service.command)}`)
  return `${lines.join('\n')}\n`
}

const renderEnvironment = (env) => {
  const entries = Object.entries(env || {})
    .filter(([key]) => Boolean(key.trim()))
    .map(([key, value]) => `${key}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)

  return entries.length
    ? entries.join(',')
    : 'PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"'
}

const renderNginxConfig = (orchestration, servicesByName, bridgeScriptUrl) => {
  const exactRoutes = []
  const regexRoutes = []
  const prefixRoutes = []

  for (const route of orchestration.routes) {
    if (route.match === 'exact') {
      exactRoutes.push(route)
      continue
    }

    if (route.match === 'regex') {
      regexRoutes.push(route)
      continue
    }

    prefixRoutes.push(route)
  }

  const routeSections = [
    ...(orchestration.homepage
      ? [renderHomepageLocation(orchestration.homepage, bridgeScriptUrl)]
      : []),
    ...exactRoutes.map((route) =>
      renderRoute(route, servicesByName, bridgeScriptUrl),
    ),
    ...regexRoutes.map((route) =>
      renderRoute(route, servicesByName, bridgeScriptUrl),
    ),
    ...prefixRoutes.map((route) =>
      renderRoute(route, servicesByName, bridgeScriptUrl),
    ),
  ]

  if (!routeSections.length) {
    routeSections.push([
      '        location / {',
      '            default_type "text/plain; charset=utf-8";',
      "            return 200 'AINative runner is running. No routes are configured.';",
      '        }',
    ].join('\n'))
  }

  return `worker_processes auto;
error_log /dev/stderr warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /dev/stdout main;

    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 100M;
    proxy_connect_timeout 60;
    proxy_send_timeout 300;
    proxy_read_timeout 300;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen ${LISTEN_PORT};
        server_name localhost;
        charset utf-8;

        location /health {
            return 200 'OK';
            add_header Content-Type text/plain;
        }

${routeSections.join('\n\n')}
    }
}
`
}

const renderNginxSubFilterForHtml = (bridgeScriptUrl) => {
  if (!bridgeScriptUrl) {
    return []
  }
  const esc = escapeNginxSubFilterAttribute(bridgeScriptUrl)
  const snip = `<script src="${esc}" defer></script>`
  const withHeadLower = snip + '</head>'
  const withHeadUpper = snip + '</HEAD>'
  return [
    '            proxy_set_header Accept-Encoding "";',
    '            sub_filter_types text/html;',
    '            sub_filter_once on;',
    `            sub_filter '</head>' '${escapeNginxSingleQuoted(withHeadLower)}';`,
    `            sub_filter '</HEAD>' '${escapeNginxSingleQuoted(withHeadUpper)}';`,
  ]
}

const escapeNginxSubFilterAttribute = (value) => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll("'", '&#39;')
    .replaceAll('"', '&quot;')
}

const renderRoute = (route, servicesByName, bridgeScriptUrl) => {
  const header =
    route.match === 'exact'
      ? `location = ${route.path} {`
      : route.match === 'regex'
        ? `location ~ ${route.path} {`
        : `location ${route.path} {`

  if (route.action === 'redirect') {
    return [
      `        ${header}`,
      `            return ${route.redirectCode || 302} ${route.redirectTo};`,
      '        }',
    ].join('\n')
  }

  const service = servicesByName.get(route.service)
  if (!service) {
    throw new Error(`Route ${route.path} references unknown service: ${route.service}`)
  }

  const targetPort = route.targetPort || service.port
  if (!targetPort) {
    throw new Error(`Route ${route.path} requires a target port`)
  }

  const proxyPass = `http://127.0.0.1:${targetPort}${route.upstreamPath || ''}`
  const lines = [
    `        ${header}`,
    `            proxy_pass ${proxyPass};`,
    '            proxy_http_version 1.1;',
    '            proxy_set_header Host $host;',
    '            proxy_set_header X-Real-IP $remote_addr;',
    '            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '            proxy_set_header X-Forwarded-Proto $scheme;',
  ]

  if (route.websocket) {
    lines.push(
      '            proxy_set_header Upgrade $http_upgrade;',
      '            proxy_set_header Connection $connection_upgrade;',
    )
  } else {
    for (const line of renderNginxSubFilterForHtml(bridgeScriptUrl)) {
      lines.push(line)
    }
  }

  lines.push('        }')
  return lines.join('\n')
}

const renderHomepageLocation = (homepage, bridgeScriptUrl) => {
  const title = escapeHtml(homepage.title || 'AINative Runner')
  const description = escapeHtml(homepage.description || '')
  const links = (homepage.links || [])
    .map(
      (link) =>
        `<a href="${escapeHtml(link.path)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`,
    )
    .join('')
  const bridgeTag = bridgeScriptUrl
    ? `<script src="${escapeHtml(bridgeScriptUrl)}" defer></script>`
    : ''
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,#f4efe8 0%,#d8e2dc 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.container{background:rgba(255,255,255,.92);border-radius:24px;padding:48px 36px;box-shadow:0 24px 60px rgba(0,0,0,.16);max-width:640px;width:100%}h1{font-size:32px;font-weight:700;color:#1f2937;text-align:center}.desc{text-align:center;color:#4b5563;margin:14px 0 32px;font-size:14px}.links{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px}a{display:flex;align-items:center;justify-content:center;padding:18px;border:1px solid #d1d5db;border-radius:14px;text-decoration:none;color:#111827;font-weight:600;background:#fff;transition:transform .2s,border-color .2s,box-shadow .2s}a:hover{transform:translateY(-2px);border-color:#2563eb;box-shadow:0 10px 24px rgba(37,99,235,.14)}@media(max-width:480px){.container{padding:36px 20px}}</style>${bridgeTag}</head><body><div class="container"><h1>${title}</h1><p class="desc">${description}</p><div class="links">${links}</div></div></body></html>`

  return [
    '        location = / {',
    '            default_type "text/html; charset=utf-8";',
    `            return 200 '${escapeNginxSingleQuoted(html)}';`,
    '        }',
  ].join('\n')
}

const normalizeStringRecord = (value) => {
  if (!value) {
    return {}
  }

  return Object.entries(value).reduce((result, [key, item]) => {
    if (typeof item === 'string' && key.trim()) {
      result[key] = item
    }
    return result
  }, {})
}

const readNonEmptyString = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function readPositiveNumber(value) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.floor(parsed)
}

const toObjectRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value
}

const trimLeadingSlash = (value) => value.replace(/^\/+/, '')
const sanitizeName = (value) => value.replace(/[^a-zA-Z0-9_.-]/g, '-')
const shellEscape = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`
const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const escapeNginxSingleQuoted = (value) =>
  String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '')

await main()
