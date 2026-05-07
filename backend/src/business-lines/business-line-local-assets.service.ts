import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import type { Express } from 'express';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Mcp } from '../mcps/domain/mcp';
import { Skill } from '../skills/domain/skill';
import {
  buildSkillDirectoryTree,
  loadBusinessLineLocalMcps,
  loadBusinessLineLocalSkillMarkdownContent,
  loadBusinessLineLocalSkills,
  packSkillAsZip,
  readSkillFile,
  resolveSkillRootDirectory,
  type SkillTreeNode,
} from '../utils/local-agent-catalog';
import {
  resolveAinativeDataRootDir,
  resolveWorkspaceRootDir,
} from '../utils/workspace-paths';
import { CreateLocalMcpDto } from './dto/create-local-mcp.dto';
import { GetLocalMcpConfigDto } from './dto/get-local-mcp-config.dto';
import { ImportLocalMcpsDto } from './dto/import-local-mcps.dto';
import { ImportLocalMcpsResultDto } from './dto/import-local-mcps-result.dto';
import { LocalMcpConfigDto } from './dto/local-mcp-config.dto';
import { LocalSkillContentDto } from './dto/local-skill-content.dto';
import { UploadLocalSkillResultDto } from './dto/upload-local-skill-result.dto';

@Injectable()
export class BusinessLineLocalAssetsService {
  private readonly maxSkillArchiveSizeBytes = 20 * 1024 * 1024;
  private readonly skillUploadExtensions = new Set(['.zip']);
  private readonly skillUploadCommandTimeoutMs = 15_000;
  private readonly localMcpConfigFileName = 'mcp.json';

  async findLocalSkills(
    businessLineId: string,
    keyword?: string,
  ): Promise<Skill[]> {
    const skills = await loadBusinessLineLocalSkills(businessLineId);
    const normalizedKeyword = keyword?.trim().toLowerCase() ?? '';
    const filtered = normalizedKeyword
      ? skills.filter((skill) => {
          const haystack =
            `${skill.name} ${skill.version} ${skill.description ?? ''}`
              .toLowerCase()
              .trim();
          return haystack.includes(normalizedKeyword);
        })
      : skills;

    return filtered.map((skill) => ({
      ...skill,
      deletedAt: null,
    }));
  }

  async findLocalSkillContent(
    businessLineId: string,
    skillId: string,
  ): Promise<LocalSkillContentDto> {
    const skillContent = await loadBusinessLineLocalSkillMarkdownContent(
      businessLineId,
      skillId,
    );

    if (!skillContent) {
      throw new NotFoundException('Skill content not found');
    }

    return skillContent;
  }

  async findLocalSkillTree(
    businessLineId: string,
    skillId: string,
  ): Promise<{ id: string; name: string; tree: SkillTreeNode[] }> {
    const targetSkill = await this.getLocalSkillOrThrow(
      businessLineId,
      skillId,
    );
    const rootDir = this.resolveLocalSkillRootOrThrow(targetSkill);
    const tree = await buildSkillDirectoryTree(rootDir);

    return { id: targetSkill.id, name: targetSkill.name, tree };
  }

  async findLocalSkillFile(
    businessLineId: string,
    skillId: string,
    filePath: string,
  ): Promise<{ path: string; content: string }> {
    const targetSkill = await this.getLocalSkillOrThrow(
      businessLineId,
      skillId,
    );
    const rootDir = this.resolveLocalSkillRootOrThrow(targetSkill);
    const content = await readSkillFile(rootDir, filePath);

    if (content === null) {
      throw new NotFoundException('File not found');
    }

    return { path: filePath, content };
  }

  async downloadLocalSkill(
    businessLineId: string,
    skillId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const targetSkill = await this.getLocalSkillOrThrow(
      businessLineId,
      skillId,
    );
    const rootDir = this.resolveLocalSkillRootOrThrow(targetSkill);
    const buffer = await packSkillAsZip(rootDir);
    const safeName =
      targetSkill.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'skill';

    return { buffer, fileName: `${safeName}.zip` };
  }

  async removeLocalSkill(
    businessLineId: string,
    skillId: string,
  ): Promise<void> {
    const targetSkill = await this.getLocalSkillOrThrow(
      businessLineId,
      skillId,
    );
    const directoryToRemove = await this.resolveLocalSkillDirectoryToRemove(
      businessLineId,
      targetSkill,
    );

    await fs.rm(directoryToRemove, { recursive: true, force: true });
  }

  async removeBusinessLineLocalAssets(businessLineId: string): Promise<void> {
    const dataRoot = path.resolve(resolveAinativeDataRootDir());
    const businessLineRoot = path.resolve(dataRoot, businessLineId);

    if (!this.isPathWithin(dataRoot, businessLineRoot)) {
      throw new BadRequestException('Invalid business line asset path');
    }

    await fs.rm(businessLineRoot, { recursive: true, force: true });
  }

  async findLocalMcps(businessLineId: string): Promise<Mcp[]> {
    const mcps = await loadBusinessLineLocalMcps(businessLineId);

    return mcps.map((mcp) => ({
      ...mcp,
      deletedAt: null,
    }));
  }

  async getLocalMcpConfig(
    businessLineId: string,
    query: GetLocalMcpConfigDto,
  ): Promise<LocalMcpConfigDto> {
    const { resolvedSourcePath, mcpName, mcpServers } =
      await this.readImportedMcpSourceConfig(businessLineId, query);
    const mcpConfig = mcpServers[mcpName];

    if (!this.isObjectRecord(mcpConfig)) {
      throw new NotFoundException('MCP config not found');
    }

    return {
      name: mcpName,
      sourcePath: resolvedSourcePath,
      config: mcpConfig,
    };
  }

  async createLocalMcp(
    businessLineId: string,
    createLocalMcpDto: CreateLocalMcpDto,
  ): Promise<Mcp> {
    const name = createLocalMcpDto.name.trim();
    const transportType = createLocalMcpDto.transportType;
    const command = createLocalMcpDto.command?.trim();
    const url = createLocalMcpDto.url?.trim();
    const args = (createLocalMcpDto.args ?? [])
      .map((item) => item.trim())
      .filter(Boolean);
    const env = this.normalizeStringMap(createLocalMcpDto.env);
    const headers = this.normalizeStringMap(createLocalMcpDto.headers);

    if (transportType === 'stdio' && !command) {
      throw new BadRequestException('MCP command is required for stdio type');
    }

    if ((transportType === 'http' || transportType === 'sse') && !url) {
      throw new BadRequestException('MCP url is required for http/sse type');
    }

    if (transportType !== 'stdio' && args.length > 0) {
      throw new BadRequestException('MCP args are only allowed for stdio type');
    }

    if (transportType !== 'stdio' && Object.keys(env).length > 0) {
      throw new BadRequestException('MCP env is only allowed for stdio type');
    }

    if (transportType === 'stdio' && Object.keys(headers).length > 0) {
      throw new BadRequestException(
        'MCP headers are only allowed for http/sse type',
      );
    }

    const targetMcpRoot = this.resolveBusinessLineMcpRoot(businessLineId);
    const targetMcpConfigPath = path.join(
      targetMcpRoot,
      this.localMcpConfigFileName,
    );

    const payload = await this.readLocalMcpConfig(targetMcpConfigPath);
    const mcpServers = this.resolveMcpServersFromPayload(payload);

    if (
      Object.keys(mcpServers).some((serverName) => serverName.trim() === name)
    ) {
      throw new ConflictException('MCP name already exists');
    }

    mcpServers[name] = this.buildLocalMcpServerConfig({
      transportType,
      command,
      args,
      env,
      url,
      headers,
    });
    payload.mcpServers = mcpServers;

    await fs.mkdir(targetMcpRoot, { recursive: true });
    await fs.writeFile(
      targetMcpConfigPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf-8',
    );

    const mcps = await loadBusinessLineLocalMcps(businessLineId);
    const createdMcp = mcps.find((mcp) => mcp.name.trim() === name);
    if (!createdMcp) {
      throw new BadRequestException('Created MCP entry could not be loaded');
    }

    return {
      ...createdMcp,
      deletedAt: null,
    };
  }

  async removeLocalMcp(
    businessLineId: string,
    query: GetLocalMcpConfigDto,
  ): Promise<void> {
    const { resolvedSourcePath, mcpName, parsedPayload, mcpServers } =
      await this.readImportedMcpSourceConfig(businessLineId, query);

    if (!this.isObjectRecord(mcpServers[mcpName])) {
      throw new NotFoundException('MCP config not found');
    }

    delete mcpServers[mcpName];
    parsedPayload.mcpServers = mcpServers;

    await fs.writeFile(
      resolvedSourcePath,
      `${JSON.stringify(parsedPayload, null, 2)}\n`,
      'utf-8',
    );
  }

  async importLocalMcps(
    businessLineId: string,
    importLocalMcpsDto: ImportLocalMcpsDto,
  ): Promise<ImportLocalMcpsResultDto> {
    const importedRawServers = this.resolveImportedMcpServers(
      importLocalMcpsDto.payload,
    );
    const importedEntries = Object.entries(importedRawServers);
    if (importedEntries.length === 0) {
      throw new BadRequestException('No MCP server found in import payload');
    }

    const targetMcpRoot = this.resolveBusinessLineMcpRoot(businessLineId);
    const targetMcpConfigPath = path.join(
      targetMcpRoot,
      this.localMcpConfigFileName,
    );

    const payload = await this.readLocalMcpConfig(targetMcpConfigPath);
    const mcpServers = this.resolveMcpServersFromPayload(payload);

    let importedCount = 0;
    let overwrittenCount = 0;

    for (const [rawName, rawConfig] of importedEntries) {
      const name = rawName.trim();
      if (!name) {
        continue;
      }

      const normalizedConfig = this.normalizeImportedMcpServerConfig(
        rawConfig,
        name,
      );

      if (mcpServers[name]) {
        overwrittenCount += 1;
      }

      importedCount += 1;
      mcpServers[name] = normalizedConfig;
    }

    if (importedCount === 0) {
      throw new BadRequestException(
        'No valid MCP server found in import payload',
      );
    }

    payload.mcpServers = mcpServers;

    await fs.mkdir(targetMcpRoot, { recursive: true });
    await fs.writeFile(
      targetMcpConfigPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf-8',
    );

    return {
      importedCount,
      overwrittenCount,
    };
  }

  async uploadLocalSkill(
    businessLineId: string,
    file: Express.Multer.File | undefined,
  ): Promise<UploadLocalSkillResultDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Skill package file is required');
    }

    if (file.size > this.maxSkillArchiveSizeBytes) {
      throw new BadRequestException(
        `Skill package size must be <= ${this.maxSkillArchiveSizeBytes} bytes`,
      );
    }

    const normalizedName = file.originalname?.trim() ?? '';
    const extension = path.extname(normalizedName).toLowerCase();
    if (!this.skillUploadExtensions.has(extension)) {
      throw new BadRequestException('Only .zip package files are supported');
    }

    const temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-skill-upload-'),
    );
    const archivePath = path.join(temporaryRoot, `upload${extension}`);
    const extractedPath = path.join(temporaryRoot, 'extracted');

    try {
      await fs.writeFile(archivePath, file.buffer);

      const archiveEntries = await this.listArchiveEntries(archivePath);
      this.ensureArchiveEntriesSafe(archiveEntries);

      const packageRoot = this.resolveSkillPackageRoot(archiveEntries);
      if (!packageRoot) {
        throw new BadRequestException(
          'Package root must contain SKILL.md file',
        );
      }

      await fs.mkdir(extractedPath, { recursive: true });
      await this.extractArchiveToDirectory(archivePath, extractedPath);

      const descriptorAbsolutePath = path.join(
        extractedPath,
        packageRoot.descriptorEntry,
      );
      const descriptorContent = await fs.readFile(
        descriptorAbsolutePath,
        'utf-8',
      );
      const descriptorMetadata =
        this.parseSkillDescriptorYaml(descriptorContent);

      if (!descriptorMetadata.name || !descriptorMetadata.description) {
        throw new BadRequestException(
          'SKILL.md YAML frontmatter must include name and description',
        );
      }

      const targetSkillDirectoryName = this.toSafeSkillDirectoryName(
        descriptorMetadata.name,
      );
      if (!targetSkillDirectoryName) {
        throw new BadRequestException('Invalid skill name in SKILL.md');
      }

      const targetSkillsRoot =
        this.resolveBusinessLineSkillsRoot(businessLineId);
      const targetSkillPath = path.join(
        targetSkillsRoot,
        targetSkillDirectoryName,
      );
      const sourceSkillPath = packageRoot.rootDirPath
        ? path.join(extractedPath, packageRoot.rootDirPath)
        : extractedPath;

      await fs.mkdir(targetSkillsRoot, { recursive: true });

      const existedStat = await this.safeStat(targetSkillPath);
      if (existedStat) {
        throw new ConflictException(
          `Skill package directory already exists: ${targetSkillDirectoryName}`,
        );
      }

      await fs.cp(sourceSkillPath, targetSkillPath, {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: (sourcePath) => {
          if (packageRoot.rootDirPath) {
            return true;
          }

          const relativePath = path
            .relative(sourceSkillPath, sourcePath)
            .replace(/\\/g, '/');

          if (!relativePath) {
            return true;
          }

          if (relativePath.startsWith('__MACOSX/')) {
            return false;
          }

          if (relativePath === '.DS_Store') {
            return false;
          }

          return true;
        },
      });

      return {
        name: descriptorMetadata.name,
        description: descriptorMetadata.description,
        directoryName: targetSkillDirectoryName,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof ConflictException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Skill package upload failed: ${error.message}`
          : 'Skill package upload failed',
      );
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  private async getLocalSkillOrThrow(
    businessLineId: string,
    skillId: string,
  ): Promise<Skill> {
    const skills = await loadBusinessLineLocalSkills(businessLineId);
    const targetSkill = skills.find((item) => item.id === skillId);

    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    return targetSkill;
  }

  private resolveLocalSkillRootOrThrow(skill: Skill): string {
    const rootDir = resolveSkillRootDirectory(skill);

    if (!rootDir) {
      throw new NotFoundException('Skill directory not found');
    }

    return rootDir;
  }

  private async resolveLocalSkillDirectoryToRemove(
    businessLineId: string,
    skill: Skill,
  ): Promise<string> {
    const sourcePath =
      skill.metadataJson && typeof skill.metadataJson === 'object'
        ? (skill.metadataJson as Record<string, unknown>).sourcePath
        : null;

    if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
      throw new BadRequestException('Skill source path is unavailable');
    }

    const trimmedSourcePath = sourcePath.trim();
    const absoluteSourcePath = path.isAbsolute(trimmedSourcePath)
      ? path.resolve(trimmedSourcePath)
      : path.resolve(resolveWorkspaceRootDir(), trimmedSourcePath);
    const businessLineSkillsRoot =
      this.resolveBusinessLineSkillsRoot(businessLineId);

    const sourceRelativePath = path.relative(
      businessLineSkillsRoot,
      absoluteSourcePath,
    );
    if (
      !sourceRelativePath ||
      sourceRelativePath.startsWith('..') ||
      path.isAbsolute(sourceRelativePath)
    ) {
      throw new BadRequestException('Skill path is outside allowed directory');
    }

    const stat = await fs.stat(absoluteSourcePath).catch(() => null);
    const directoryToRemove = stat?.isDirectory()
      ? absoluteSourcePath
      : path.dirname(absoluteSourcePath);

    const dirRelativePath = path.relative(
      businessLineSkillsRoot,
      directoryToRemove,
    );
    if (
      !dirRelativePath ||
      dirRelativePath.startsWith('..') ||
      path.isAbsolute(dirRelativePath)
    ) {
      throw new BadRequestException('Skill path is outside allowed directory');
    }

    return directoryToRemove;
  }

  private resolveBusinessLineSkillsRoot(businessLineId: string): string {
    return path.resolve(resolveAinativeDataRootDir(), businessLineId, 'skills');
  }

  private resolveBusinessLineMcpRoot(businessLineId: string): string {
    return path.resolve(resolveAinativeDataRootDir(), businessLineId, 'mcp');
  }

  private async readImportedMcpSourceConfig(
    businessLineId: string,
    query: GetLocalMcpConfigDto,
  ): Promise<{
    resolvedSourcePath: string;
    mcpName: string;
    parsedPayload: Record<string, unknown>;
    mcpServers: Record<string, unknown>;
  }> {
    const resolvedSourcePath = path.resolve(query.sourcePath.trim());
    const mcpName = query.name.trim();

    if (!mcpName) {
      throw new BadRequestException('MCP name is required');
    }

    const mcpRoot = this.resolveBusinessLineMcpRoot(businessLineId);
    if (!this.isPathWithin(mcpRoot, resolvedSourcePath)) {
      throw new BadRequestException('Invalid MCP source path');
    }

    const parsedPayload = await this.readJsonObjectFile(
      resolvedSourcePath,
      'MCP source',
    );
    const mcpServers = this.resolveImportedMcpServers(parsedPayload);

    if (!this.isObjectRecord(mcpServers)) {
      throw new BadRequestException('Invalid MCP servers payload');
    }

    return {
      resolvedSourcePath,
      mcpName,
      parsedPayload,
      mcpServers,
    };
  }

  private async readJsonObjectFile(
    filePath: string,
    label: string,
  ): Promise<Record<string, unknown>> {
    const content = await fs.readFile(filePath, 'utf-8').catch((error) => {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        throw new NotFoundException(`${label} file not found`);
      }
      throw error;
    });

    try {
      const parsed = JSON.parse(content);
      if (!this.isObjectRecord(parsed)) {
        throw new BadRequestException(`${label} file must be a JSON object`);
      }

      return parsed;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Failed to parse ${label} JSON: ${error.message}`
          : `Failed to parse ${label} JSON`,
      );
    }
  }

  private parseSkillDescriptorYaml(content: string): {
    name: string | null;
    description: string | null;
  } {
    const yamlFrontmatterMatch = content.match(
      /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    );
    if (!yamlFrontmatterMatch?.[1]) {
      return { name: null, description: null };
    }

    const yamlKeyValueMap = this.parseSimpleYamlFrontmatter(
      yamlFrontmatterMatch[1],
    );

    return {
      name: this.normalizeOptionalText(yamlKeyValueMap.name),
      description: this.normalizeOptionalText(yamlKeyValueMap.description),
    };
  }

  private parseSimpleYamlFrontmatter(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const delimiterIndex = line.indexOf(':');
      if (delimiterIndex <= 0) {
        continue;
      }

      const key = line.slice(0, delimiterIndex).trim();
      const value = this.stripWrappedQuotes(
        line.slice(delimiterIndex + 1).trim(),
      );
      if (!key || !value) {
        continue;
      }

      result[key] = value;
    }

    return result;
  }

  private stripWrappedQuotes(value: string): string {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1).trim();
    }

    return value;
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private toSafeSkillDirectoryName(skillName: string): string {
    return skillName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeArchiveEntryPath(rawPath: string): string {
    return rawPath
      .replace(/\\/g, '/')
      .replace(/^\.\/+/, '')
      .replace(/\/+/g, '/')
      .trim();
  }

  private ensureArchiveEntriesSafe(entries: string[]): void {
    if (entries.length === 0) {
      throw new BadRequestException('Skill package is empty');
    }

    for (const rawEntry of entries) {
      const entry = this.normalizeArchiveEntryPath(rawEntry);
      if (!entry) {
        continue;
      }

      if (entry.includes('\u0000')) {
        throw new BadRequestException('Skill package contains invalid path');
      }

      if (entry.startsWith('/') || entry.startsWith('~')) {
        throw new BadRequestException('Skill package contains unsafe path');
      }

      const segments = entry.split('/').filter(Boolean);
      if (segments.some((segment) => segment === '..')) {
        throw new BadRequestException(
          'Skill package contains path traversal entry',
        );
      }
    }
  }

  private resolveSkillPackageRoot(entries: string[]): {
    descriptorEntry: string;
    rootDirPath: string;
  } | null {
    const normalizedEntries = entries
      .map((item) => this.normalizeArchiveEntryPath(item))
      .filter(Boolean);

    const validFileEntries = normalizedEntries.filter(
      (item) =>
        !item.endsWith('/') &&
        !item.startsWith('__MACOSX/') &&
        item !== '.DS_Store',
    );

    if (validFileEntries.includes('SKILL.md')) {
      return {
        descriptorEntry: 'SKILL.md',
        rootDirPath: '',
      };
    }

    const skillEntriesInSubDirectory = validFileEntries.filter((entry) =>
      /^[^/]+\/SKILL\.md$/.test(entry),
    );
    if (skillEntriesInSubDirectory.length === 0) {
      return null;
    }

    const rootDirCandidates = Array.from(
      new Set(
        skillEntriesInSubDirectory.map((entry) =>
          entry.slice(0, entry.indexOf('/')),
        ),
      ),
    );

    if (rootDirCandidates.length !== 1) {
      return null;
    }

    const rootDirPath = rootDirCandidates[0];
    if (!rootDirPath) {
      return null;
    }

    const hasOutsideRootFiles = validFileEntries.some((entry) => {
      return entry !== rootDirPath && !entry.startsWith(`${rootDirPath}/`);
    });
    if (hasOutsideRootFiles) {
      return null;
    }

    return {
      descriptorEntry: `${rootDirPath}/SKILL.md`,
      rootDirPath,
    };
  }

  private async listArchiveEntries(archivePath: string): Promise<string[]> {
    const commandResult = await this.runCommand('unzip', ['-Z1', archivePath]);
    if (!commandResult.success) {
      throw new BadRequestException('Invalid skill package archive');
    }

    return commandResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private async extractArchiveToDirectory(
    archivePath: string,
    directoryPath: string,
  ): Promise<void> {
    const commandResult = await this.runCommand('unzip', [
      '-oq',
      archivePath,
      '-d',
      directoryPath,
    ]);
    if (!commandResult.success) {
      throw new BadRequestException('Failed to extract skill package');
    }
  }

  private async runCommand(
    command: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, args, {
        env: process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (chunk) => {
        stdout += chunk.toString('utf-8');
      });

      childProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      const timeoutRef = setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, this.skillUploadCommandTimeoutMs);

      childProcess.on('error', (error) => {
        clearTimeout(timeoutRef);
        resolve({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: error.message,
        });
      });

      childProcess.on('close', (code) => {
        clearTimeout(timeoutRef);
        resolve({
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        });
      });
    });
  }

  private async readLocalMcpConfig(
    targetMcpConfigPath: string,
  ): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(targetMcpConfigPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (this.isObjectRecord(parsed)) {
        return parsed;
      }
      return {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return {};
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Invalid local MCP config JSON: ${error.message}`
          : 'Invalid local MCP config JSON',
      );
    }
  }

  private resolveMcpServersFromPayload(
    payload: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    if (!this.isObjectRecord(payload.mcpServers)) {
      return {};
    }

    const result: Record<string, Record<string, unknown>> = {};
    for (const [serverName, serverValue] of Object.entries(
      payload.mcpServers,
    )) {
      if (!this.isObjectRecord(serverValue)) {
        continue;
      }
      result[serverName] = { ...serverValue };
    }

    return result;
  }

  private buildLocalMcpServerConfig(params: {
    transportType: 'stdio' | 'http' | 'sse';
    command?: string;
    args: string[];
    env: Record<string, string>;
    url?: string;
    headers: Record<string, string>;
  }): Record<string, unknown> {
    if (params.transportType === 'stdio') {
      return {
        command: params.command,
        ...(params.args.length > 0 ? { args: params.args } : {}),
        ...(Object.keys(params.env).length > 0 ? { env: params.env } : {}),
      };
    }

    return {
      url: params.url,
      ...(params.transportType === 'sse' ? { type: 'sse' } : {}),
      ...(Object.keys(params.headers).length > 0
        ? {
            headers: params.headers,
          }
        : {}),
    };
  }

  private resolveImportedMcpServers(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.isObjectRecord(payload.mcpServers)) {
      return payload.mcpServers;
    }

    return payload;
  }

  private normalizeImportedMcpServerConfig(
    value: unknown,
    serverName: string,
  ): Record<string, unknown> {
    if (!this.isObjectRecord(value)) {
      throw new BadRequestException(
        `Invalid MCP config for server "${serverName}"`,
      );
    }

    const url = this.normalizeOptionalText(value.url);
    if (url) {
      const type = this.normalizeOptionalText(value.type)?.toLowerCase();
      if (type && type !== 'http' && type !== 'sse') {
        throw new BadRequestException(
          `Invalid MCP type for server "${serverName}"`,
        );
      }

      const headers = this.normalizeStringMap(value.headers);
      const description = this.normalizeOptionalText(value.description);
      return {
        url,
        ...(type === 'sse' ? { type: 'sse' } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(description ? { description } : {}),
      };
    }

    const command = this.normalizeOptionalText(value.command);
    if (!command) {
      throw new BadRequestException(
        `MCP server "${serverName}" must include command or url`,
      );
    }

    const args = this.normalizeStringArray(value.args, serverName);
    const env = this.normalizeStringMap(value.env);
    const description = this.normalizeOptionalText(value.description);

    return {
      command,
      ...(args.length > 0 ? { args } : {}),
      ...(Object.keys(env).length > 0 ? { env } : {}),
      ...(description ? { description } : {}),
    };
  }

  private normalizeStringArray(value: unknown, serverName: string): string[] {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException(
        `Invalid MCP args for server "${serverName}"`,
      );
    }

    return value
      .map((item) => {
        if (typeof item !== 'string') {
          throw new BadRequestException(
            `Invalid MCP args for server "${serverName}"`,
          );
        }
        return item.trim();
      })
      .filter(Boolean);
  }

  private normalizeStringMap(value: unknown): Record<string, string> {
    if (!this.isObjectRecord(value)) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.trim();
      if (!normalizedKey || typeof entry !== 'string') {
        continue;
      }

      result[normalizedKey] = entry;
    }

    return result;
  }

  private isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private isPathWithin(rootPath: string, targetPath: string): boolean {
    const relativePath = path.relative(rootPath, targetPath);
    if (!relativePath) {
      return true;
    }

    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  private async safeStat(
    targetPath: string,
  ): Promise<import('fs').Stats | null> {
    try {
      return await fs.stat(targetPath);
    } catch {
      return null;
    }
  }
}
