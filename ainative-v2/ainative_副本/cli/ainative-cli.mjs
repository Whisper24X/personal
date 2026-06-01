#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const DEFAULT_IMAGE = process.env.AINATIVE_RUNNER_IMAGE?.trim() || 'ainative/runner:latest'
const DEFAULT_CONFIG_FILE = 'ainative.runner.json'
const RUNNER_MANAGED_VOLUME_LABEL = 'ainative.runner-managed'
const RUNNER_MANAGED_VOLUME_CONTAINER_LABEL = 'ainative.container-name'

const main = async () => {
  const argv = process.argv.slice(2)
  const normalizedArgv = argv[0] === '--' ? argv.slice(1) : argv
  const [namespace, command, ...args] = normalizedArgv
  if (namespace !== 'runner' || !command) {
    printHelp()
    process.exitCode = 1
    return
  }

  const configPath = await findConfigFile(process.cwd())
  if (!configPath) {
    throw new Error(`Could not find ${DEFAULT_CONFIG_FILE} from ${process.cwd()}`)
  }

  const repoRoot = path.dirname(configPath)
  const rawConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'))
  const config = normalizeRunnerConfig(rawConfig, repoRoot)

  switch (command) {
    case 'up':
      await runUp(config, args)
      return
    case 'down':
      await runDown(config)
      return
    case 'restart':
      await runDown(config)
      await runUp(config, args)
      return
    case 'status':
      await runStatus(config)
      return
    case 'logs':
      await runLogs(config, args[0]?.trim() || '')
      return
    case 'shell':
      await runShell(config)
      return
    default:
      printHelp()
      process.exitCode = 1
  }
}

const printHelp = () => {
  console.error(`Usage:
  ainative runner up [--port 8080] [--image ainative/runner:latest]
  ainative runner down
  ainative runner restart
  ainative runner status
  ainative runner logs [service]
  ainative runner shell`)
}

const normalizeRunnerConfig = (value, repoRoot) => {
  const source = toObjectRecord(value)
  if (!source) {
    throw new Error('Runner config must be a JSON object')
  }

  const runtime = toObjectRecord(source.runtime)
  const orchestration = toObjectRecord(source.orchestration) ?? source
  const services = Array.isArray(orchestration.services) ? orchestration.services : []
  const sharedVolumes = Array.isArray(runtime?.sharedVolumes) ? runtime.sharedVolumes : []
  const env = toStringRecord(toObjectRecord(runtime?.env))
  const preview = toObjectRecord(orchestration.preview)
  const repoName = path.basename(repoRoot)
  const containerName = sanitizeName(
    `ainative-runner-${source.project?.id || source.project?.name || repoName}`,
  )
  const listenPort =
    readPositiveNumber(runtime?.listenPort) ||
    readPositiveNumber(runtime?.containerPort) ||
    8080
  const hostPort =
    readPositiveNumber(runtime?.hostPort) ||
    readPositiveNumber(runtime?.listenPort) ||
    readPositiveNumber(runtime?.containerPort) ||
    8080

  return {
    repoRoot,
    configPath: path.join(repoRoot, DEFAULT_CONFIG_FILE),
    containerName,
    image: readString(process.env.AINATIVE_RUNNER_IMAGE) || DEFAULT_IMAGE,
    networkMode: runtime?.networkMode === 'host' ? 'host' : 'bridge',
    hostIp: readString(runtime?.hostIp) || '127.0.0.1',
    hostPort,
    listenPort,
    startTimeoutMs: readPositiveNumber(runtime?.startTimeoutMs) || 300000,
    resourceLimits: {
      memoryMb: readPositiveNumber(runtime?.resourceLimits?.memoryMb),
      pidsLimit: readPositiveNumber(runtime?.resourceLimits?.pidsLimit),
    },
    env,
    previewPath: readString(preview?.path) || '/',
    sharedVolumes: sharedVolumes
      .map((item) => {
        const volume = toObjectRecord(item)
        const name = readString(volume?.name)
        const target = readString(volume?.target)
        if (!name || !target) {
          return null
        }

        return {
          name: `${sanitizeName(containerName)}-${sanitizeName(name)}`,
          target,
        }
      })
      .filter(Boolean),
    managedVolumeMounts: services
      .map((service) => {
        const serviceRecord = toObjectRecord(service)
        const workdir = readString(serviceRecord?.workdir)
        const installCommand = readString(serviceRecord?.installCommand)
        if (!workdir || !installCommand) {
          return null
        }

        const target = `/workspace/${trimLeadingSlash(workdir)}/node_modules`
        return {
          name: buildManagedVolumeName(containerName, target),
          target,
          labels: {
            [RUNNER_MANAGED_VOLUME_LABEL]: 'true',
            [RUNNER_MANAGED_VOLUME_CONTAINER_LABEL]: containerName,
            'ainative.mount-target': target,
          },
        }
      })
      .filter(Boolean),
  }
}

const runUp = async (config, args) => {
  const image = readOption(args, '--image') || config.image
  const portOverride = readPositiveNumber(readOption(args, '--port'))
  const hostPort = portOverride || config.hostPort
  const logsDir = path.join(config.repoRoot, 'logs')
  await fs.mkdir(logsDir, { recursive: true })

  const existing = await dockerCapture([
    'ps',
    '-a',
    '--filter',
    `name=^${config.containerName}$`,
    '--format',
    '{{.Names}} {{.Status}}',
  ])

  if (existing.trim()) {
    if (existing.includes('Up ')) {
      printStatus(config, hostPort)
      return
    }

    await runDown(config)
  }

  await ensureManagedVolumes(config.managedVolumeMounts)

  const argsList = [
    'run',
    '-d',
    '--name',
    config.containerName,
    '--network',
    config.networkMode,
    '-v',
    `${config.repoRoot}:/workspace`,
    '-v',
    `${logsDir}:/workspace/logs`,
  ]

  if (config.networkMode === 'bridge') {
    argsList.push('-p', `${config.hostIp}:${hostPort}:${config.listenPort}`)
  }

  if (config.resourceLimits.memoryMb) {
    argsList.push('--memory', `${config.resourceLimits.memoryMb}m`)
  }
  if (config.resourceLimits.pidsLimit) {
    argsList.push('--pids-limit', String(config.resourceLimits.pidsLimit))
  }

  for (const volume of config.sharedVolumes) {
    argsList.push('-v', `${volume.name}:${volume.target}`)
  }
  for (const volume of config.managedVolumeMounts) {
    argsList.push('-v', `${volume.name}:${volume.target}`)
  }

  const env = {
    ...config.env,
    AINATIVE_RUNNER_LISTEN_PORT: String(config.listenPort),
  }
  for (const [key, value] of Object.entries(env)) {
    argsList.push('-e', `${key}=${value}`)
  }

  argsList.push(image, '/usr/local/bin/ainative-runner-entrypoint')
  try {
    await dockerRun(argsList)
    await waitForReadiness(config, hostPort)
    printStatus(config, hostPort)
  } catch (error) {
    await runDown(config)
    throw error
  }
}

const runDown = async (config) => {
  await dockerRun(['rm', '-f', config.containerName], { allowFailure: true })
  await removeManagedVolumes(config)
}

const runStatus = async (config) => {
  const inspect = await dockerCapture([
    'inspect',
    config.containerName,
    '--format',
    '{{json .State}}',
  ], { allowFailure: true })

  if (!inspect.trim()) {
    console.log(`container: ${config.containerName}`)
    console.log('status: stopped')
    return
  }

  const state = JSON.parse(inspect)
  console.log(`container: ${config.containerName}`)
  console.log(`status: ${state.Status || 'unknown'}`)
  if (state.Running) {
    printStatus(config, config.hostPort)
  }
}

const runLogs = async (config, serviceName) => {
  if (serviceName) {
    await dockerRun([
      'exec',
      '-it',
      config.containerName,
      'sh',
      '-lc',
      `tail -n 200 -f /workspace/logs/${serviceName.replace(/[^a-zA-Z0-9_.-]/g, '-')}.log`,
    ], { inherit: true })
    return
  }

  await dockerRun(['logs', '-f', config.containerName], { inherit: true })
}

const runShell = async (config) => {
  await dockerRun(['exec', '-it', config.containerName, 'bash'], {
    inherit: true,
  })
}

const ensureManagedVolumes = async (mounts) => {
  for (const mount of mounts) {
    const args = ['volume', 'create']
    for (const [key, value] of Object.entries(mount.labels || {})) {
      args.push('--label', `${key}=${value}`)
    }
    args.push(mount.name)
    await dockerCapture(args, { quiet: true })
  }
}

const removeManagedVolumes = async (config) => {
  const output = await dockerCapture([
    'volume',
    'ls',
    '--quiet',
    '--filter',
    `label=${RUNNER_MANAGED_VOLUME_LABEL}=true`,
    '--filter',
    `label=${RUNNER_MANAGED_VOLUME_CONTAINER_LABEL}=${config.containerName}`,
  ], { allowFailure: true, quiet: true })

  const names = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const name of names) {
    await dockerRun(['volume', 'rm', '-f', name], {
      allowFailure: true,
      quiet: true,
    })
  }
}

const waitForReadiness = async (config, hostPort) => {
  const deadline = Date.now() + config.startTimeoutMs
  while (Date.now() < deadline) {
    const code = await dockerRun([
      'exec',
      config.containerName,
      'sh',
      '-lc',
      `curl -fsS --max-time 2 http://127.0.0.1:${config.listenPort}/health >/dev/null`,
    ], { allowFailure: true, quiet: true })

    if (code === 0) {
      return
    }

    await sleep(1000)
  }

  throw new Error(
    `Runner container did not become ready within ${config.startTimeoutMs}ms on http://${config.hostIp}:${hostPort}/health`,
  )
}

const printStatus = (config, hostPort) => {
  const baseUrl =
    config.networkMode === 'bridge'
      ? `http://${config.hostIp}:${hostPort}`
      : `http://127.0.0.1:${config.listenPort}`
  console.log(`container: ${config.containerName}`)
  console.log(`config: ${config.configPath}`)
  console.log(`url: ${appendPreviewPath(baseUrl, config.previewPath)}`)
}

const findConfigFile = async (startDir) => {
  let currentDir = path.resolve(startDir)
  while (true) {
    const candidate = path.join(currentDir, DEFAULT_CONFIG_FILE)
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        return null
      }
      currentDir = parentDir
    }
  }
}

const dockerCapture = async (args, options = {}) => {
  let stdout = ''
  let stderr = ''

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })

  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(stderr.trim() || `docker ${args[0]} failed`)
  }

  return stdout.trim()
}

const dockerRun = async (args, options = {}) => {
  if (options.inherit) {
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('docker', args, {
        stdio: 'inherit',
      })
      child.once('error', reject)
      child.once('close', (code) => resolve(code ?? 1))
    })

    if (exitCode !== 0 && !options.allowFailure) {
      throw new Error(`docker ${args[0]} failed with code ${exitCode}`)
    }

    return exitCode
  }

  let stdout = ''
  let stderr = ''
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (!options.quiet) {
        process.stdout.write(chunk)
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (!options.quiet) {
        process.stderr.write(chunk)
      }
    })
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })

  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(stderr.trim() || stdout.trim() || `docker ${args[0]} failed`)
  }

  return exitCode
}

const readOption = (args, name) => {
  const index = args.indexOf(name)
  if (index < 0) {
    return ''
  }

  return args[index + 1] || ''
}

const readString = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const readPositiveNumber = (value) => {
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

const toStringRecord = (value) => {
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

const trimLeadingSlash = (value) => value.replace(/^\/+/, '')
const sanitizeName = (value) => String(value).replace(/[^a-zA-Z0-9_.-]/g, '-')
const buildManagedVolumeName = (containerName, target) => {
  const suffix =
    trimLeadingSlash(target)
      .split('/')
      .filter(Boolean)
      .map((segment) => sanitizeName(segment.toLowerCase()))
      .join('-') || 'workspace'
  return `${containerName}-${suffix}`
}
const appendPreviewPath = (baseUrl, previewPath) => {
  const normalizedPath = readString(previewPath)
  if (!normalizedPath || normalizedPath === '/') {
    return baseUrl
  }

  return `${baseUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
