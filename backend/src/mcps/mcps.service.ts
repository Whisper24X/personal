import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { Mcp } from './domain/mcp';
import { FindAllMcpsDto } from './dto/find-all-mcps.dto';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';
import {
  loadProjectLocalMcps,
  resolveProjectLocalMcpConfigPath,
  resolveProjectLocalMcpConfigPathMap,
} from '../utils/local-agent-catalog';
import { GetProjectLocalMcpConfigDto } from './dto/get-project-local-mcp-config.dto';
import {
  ImportProjectLocalMcpsDto,
  ProjectLocalMcpProvider,
} from './dto/import-project-local-mcps.dto';
import { ImportProjectLocalMcpsResultDto } from './dto/import-project-local-mcps-result.dto';
import { ProjectLocalMcpConfigDto } from './dto/project-local-mcp-config.dto';
import { RemoveProjectLocalMcpDto } from './dto/remove-project-local-mcp.dto';

@Injectable()
export class McpsService {
  constructor(private readonly projectsService: ProjectsService) {}

  async findAllWithPagination(
    query: FindAllMcpsDto,
    currentUser: JwtPayloadType,
  ): Promise<Mcp[]> {
    if (!query.projectId) {
      return [];
    }

    const project = await this.projectsService.assertCanAccessProject(
      query.projectId,
      currentUser,
    );
    const localMcps = await loadProjectLocalMcps(project);

    return this.filterAndPaginateLocalMcps(localMcps, query);
  }

  async getProjectLocalMcpConfig(
    query: GetProjectLocalMcpConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectLocalMcpConfigDto> {
    const project = await this.projectsService.assertCanAccessProject(
      query.projectId,
      currentUser,
    );

    const sourcePath = path.resolve(query.sourcePath.trim());
    const mcpName = query.name.trim();
    if (!mcpName) {
      throw new BadRequestException('MCP name is required');
    }

    const sourcePathMap = await resolveProjectLocalMcpConfigPathMap(project);
    if (!sourcePathMap) {
      throw new NotFoundException('Project MCP directory not found');
    }

    const allowedPaths = new Set(
      Object.values(sourcePathMap).map((item) => path.resolve(item)),
    );
    if (!allowedPaths.has(sourcePath)) {
      throw new BadRequestException('Invalid MCP source path');
    }
    const sourceFileExtension = path.extname(sourcePath).toLowerCase();

    const localMcps = await loadProjectLocalMcps(project);
    const matchedMcp = localMcps.find((item) => {
      if (item.name.trim() !== mcpName) {
        return false;
      }

      const metadata = this.isObjectRecord(item.metadataJson)
        ? item.metadataJson
        : null;
      const itemSourcePath =
        typeof metadata?.sourcePath === 'string'
          ? path.resolve(metadata.sourcePath)
          : '';

      return itemSourcePath === sourcePath;
    });
    if (!matchedMcp) {
      throw new NotFoundException('MCP config not found');
    }

    if (sourceFileExtension === '.json') {
      const payload = await this.readLocalMcpConfig(sourcePath);
      const mcpServers = this.resolveMcpServersFromPayload(payload).servers;
      const mcpConfig = mcpServers[mcpName];
      if (!this.isObjectRecord(mcpConfig)) {
        throw new NotFoundException('MCP config not found');
      }

      return {
        name: mcpName,
        sourcePath,
        config: mcpConfig,
      };
    }

    if (sourceFileExtension === '.toml') {
      const tomlContent = await this.readLocalTextFile(sourcePath);
      const mcpServers = this.parseTomlMcpServers(tomlContent);
      const mcpConfig = mcpServers[mcpName];
      if (!this.isObjectRecord(mcpConfig)) {
        throw new NotFoundException('MCP config not found');
      }

      return {
        name: mcpName,
        sourcePath,
        config: mcpConfig,
      };
    }

    throw new BadRequestException('Current MCP source format is not editable');
  }

  async importProjectLocalMcps(
    importProjectLocalMcpsDto: ImportProjectLocalMcpsDto,
    currentUser: JwtPayloadType,
  ): Promise<ImportProjectLocalMcpsResultDto> {
    const project = await this.projectsService.assertCanManageProject(
      importProjectLocalMcpsDto.projectId,
      currentUser,
    );

    const targetPath = await resolveProjectLocalMcpConfigPath(
      project,
      importProjectLocalMcpsDto.provider as ProjectLocalMcpProvider,
    );
    if (!targetPath) {
      throw new NotFoundException('Project MCP directory not found');
    }

    const targetFileExtension = path.extname(targetPath).toLowerCase();

    const importedRawServers = this.resolveImportedMcpServers(
      importProjectLocalMcpsDto.payload,
    );
    const importedEntries = Object.entries(importedRawServers);
    if (importedEntries.length === 0) {
      throw new BadRequestException('No MCP server found in import payload');
    }

    if (targetFileExtension === '.json') {
      const payload = await this.readLocalMcpConfig(targetPath);
      const { containerKey, servers } = this.resolveMcpServersFromPayload(
        payload,
        importProjectLocalMcpsDto.provider as ProjectLocalMcpProvider,
      );

      let importedCount = 0;
      let overwrittenCount = 0;

      for (const [rawName, rawConfig] of importedEntries) {
        const name = rawName.trim();
        if (!name || !this.isObjectRecord(rawConfig)) {
          continue;
        }

        if (this.isObjectRecord(servers[name])) {
          overwrittenCount += 1;
        }

        importedCount += 1;
        servers[name] = { ...rawConfig };
      }

      if (importedCount === 0) {
        throw new BadRequestException(
          'No valid MCP server found in import payload',
        );
      }

      payload[containerKey] = servers;

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`);

      return {
        importedCount,
        overwrittenCount,
      };
    }

    if (targetFileExtension === '.toml') {
      const existingContent = await this.readLocalTextFile(targetPath);
      const existingServers = this.parseTomlMcpServers(existingContent);
      const updates: Record<string, Record<string, unknown>> = {};

      let importedCount = 0;
      let overwrittenCount = 0;

      for (const [rawName, rawConfig] of importedEntries) {
        const name = rawName.trim();
        if (!name || !this.isObjectRecord(rawConfig)) {
          continue;
        }

        if (this.isObjectRecord(existingServers[name])) {
          overwrittenCount += 1;
        }

        importedCount += 1;
        updates[name] = { ...rawConfig };
      }

      if (importedCount === 0) {
        throw new BadRequestException(
          'No valid MCP server found in import payload',
        );
      }

      const nextContent = this.upsertTomlMcpServers(existingContent, updates);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, nextContent, 'utf-8');

      return {
        importedCount,
        overwrittenCount,
      };
    }

    throw new BadRequestException(
      'Current provider does not support MCP config import',
    );
  }

  async removeProjectLocalMcp(
    dto: RemoveProjectLocalMcpDto,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const project = await this.projectsService.assertCanManageProject(
      dto.projectId,
      currentUser,
    );

    const sourcePath = path.resolve(dto.sourcePath.trim());
    const mcpName = dto.name.trim();
    if (!mcpName) {
      throw new BadRequestException('MCP name is required');
    }

    const sourcePathMap = await resolveProjectLocalMcpConfigPathMap(project);
    if (!sourcePathMap) {
      throw new NotFoundException('Project MCP directory not found');
    }

    const allowedPaths = new Set(
      Object.values(sourcePathMap).map((item) => path.resolve(item)),
    );
    if (!allowedPaths.has(sourcePath)) {
      throw new BadRequestException('Invalid MCP source path');
    }

    const sourceFileExtension = path.extname(sourcePath).toLowerCase();

    if (sourceFileExtension === '.json') {
      const payload = await this.readLocalMcpConfig(sourcePath);
      const { containerKey, servers } = this.resolveMcpServersFromPayload(
        payload,
        dto.provider as ProjectLocalMcpProvider,
      );

      if (!this.isObjectRecord(servers[mcpName])) {
        throw new NotFoundException('MCP config not found');
      }

      delete servers[mcpName];
      payload[containerKey] = servers;

      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(
        sourcePath,
        `${JSON.stringify(payload, null, 2)}\n`,
        'utf-8',
      );
      return;
    }

    if (sourceFileExtension === '.toml') {
      const existingContent = await this.readLocalTextFile(sourcePath);
      const existingServers = this.parseTomlMcpServers(existingContent);

      if (!this.isObjectRecord(existingServers[mcpName])) {
        throw new NotFoundException('MCP config not found');
      }

      const nextContent = this.removeTomlMcpServer(existingContent, mcpName);
      await fs.writeFile(sourcePath, nextContent, 'utf-8');
      return;
    }

    throw new BadRequestException(
      'Current MCP source format does not support removal',
    );
  }

  private filterAndPaginateLocalMcps(
    mcps: Mcp[],
    query: FindAllMcpsDto,
  ): Mcp[] {
    const keyword = query.keyword?.trim().toLowerCase() ?? '';
    const filtered = mcps.filter((mcp) => {
      if (query.enabled !== undefined && mcp.enabled !== query.enabled) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const targetText =
        `${mcp.name} ${mcp.version} ${mcp.provider ?? ''} ${mcp.description ?? ''}`
          .toLowerCase()
          .trim();

      return targetText.includes(keyword);
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    return filtered.slice(offset, offset + limit);
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
          ? `Invalid project MCP config JSON: ${error.message}`
          : 'Invalid project MCP config JSON',
      );
    }
  }

  private async readLocalTextFile(targetPath: string): Promise<string> {
    try {
      return await fs.readFile(targetPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return '';
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Failed to read MCP config file: ${error.message}`
          : 'Failed to read MCP config file',
      );
    }
  }

  private resolveMcpServersFromPayload(
    payload: Record<string, unknown>,
    provider?: ProjectLocalMcpProvider,
  ): {
    containerKey: 'mcpServers' | 'mcp_servers' | 'mcps' | 'mcp';
    servers: Record<string, unknown>;
  } {
    if (this.isObjectRecord(payload.mcpServers)) {
      return {
        containerKey: 'mcpServers',
        servers: { ...payload.mcpServers },
      };
    }

    if (this.isObjectRecord(payload.mcp_servers)) {
      return {
        containerKey: 'mcp_servers',
        servers: { ...payload.mcp_servers },
      };
    }

    if (this.isObjectRecord(payload.mcps)) {
      return {
        containerKey: 'mcps',
        servers: { ...payload.mcps },
      };
    }

    if (this.isObjectRecord(payload.mcp)) {
      return {
        containerKey: 'mcp',
        servers: { ...payload.mcp },
      };
    }

    return {
      containerKey: provider === 'opencode' ? 'mcp' : 'mcpServers',
      servers: {},
    };
  }

  private resolveImportedMcpServers(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.isObjectRecord(payload.mcpServers)) {
      return payload.mcpServers;
    }

    if (this.isObjectRecord(payload.mcp_servers)) {
      return payload.mcp_servers;
    }

    if (this.isObjectRecord(payload.mcps)) {
      return payload.mcps;
    }

    if (this.isObjectRecord(payload.mcp)) {
      return payload.mcp;
    }

    return payload;
  }

  private isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private normalizeTomlKeyOrSection(value: string): string {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }

    return trimmed;
  }

  private splitTomlTopLevel(input: string, separator: string): string[] {
    const segments: string[] = [];
    let quoteChar = '';
    let braceDepth = 0;
    let bracketDepth = 0;
    let startIndex = 0;

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index] ?? '';
      if (quoteChar) {
        if (char === quoteChar && input[index - 1] !== '\\') {
          quoteChar = '';
        }
        continue;
      }

      if (char === '"' || char === "'") {
        quoteChar = char;
        continue;
      }

      if (char === '{') {
        braceDepth += 1;
        continue;
      }

      if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }

      if (char === '[') {
        bracketDepth += 1;
        continue;
      }

      if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        continue;
      }

      if (char === separator && braceDepth === 0 && bracketDepth === 0) {
        segments.push(input.slice(startIndex, index));
        startIndex = index + 1;
      }
    }

    segments.push(input.slice(startIndex));
    return segments.map((segment) => segment.trim()).filter(Boolean);
  }

  private parseTomlValue(rawValue: string): unknown {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return '';
    }

    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    if (trimmed === 'true') {
      return true;
    }

    if (trimmed === 'false') {
      return false;
    }

    const numberValue = Number(trimmed);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) {
        return [];
      }

      return this.splitTomlTopLevel(inner, ',').map((item) =>
        this.parseTomlValue(item),
      );
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) {
        return {};
      }

      const result: Record<string, unknown> = {};
      const entries = this.splitTomlTopLevel(inner, ',');
      for (const entry of entries) {
        const equalIndex = entry.indexOf('=');
        if (equalIndex <= 0) {
          continue;
        }

        const key = this.normalizeTomlKeyOrSection(entry.slice(0, equalIndex));
        const value = entry.slice(equalIndex + 1).trim();
        result[key] = this.parseTomlValue(value);
      }

      return result;
    }

    return trimmed;
  }

  private parseTomlMcpServers(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split(/\r?\n/);
    const headerRegex = /^\s*\[(?:mcp_servers|mcpServers)\.([^\]]+)\]\s*$/;
    let currentServerName = '';

    for (const line of lines) {
      const headerMatch = headerRegex.exec(line);
      if (headerMatch?.[1]) {
        currentServerName = this.normalizeTomlKeyOrSection(headerMatch[1]);
        if (!this.isObjectRecord(result[currentServerName])) {
          result[currentServerName] = {};
        }
        continue;
      }

      if (!currentServerName) {
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex <= 0) {
        continue;
      }

      const key = this.normalizeTomlKeyOrSection(trimmed.slice(0, equalIndex));
      const value = trimmed.slice(equalIndex + 1).trim();
      const currentServer: Record<string, unknown> = this.isObjectRecord(
        result[currentServerName],
      )
        ? { ...(result[currentServerName] as Record<string, unknown>) }
        : {};
      currentServer[key] = this.parseTomlValue(value);
      result[currentServerName] = currentServer;
    }

    return result;
  }

  private serializeTomlValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}"`;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : null;
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (Array.isArray(value)) {
      const items = value
        .map((item) => this.serializeTomlValue(item))
        .filter((item): item is string => typeof item === 'string');
      return `[${items.join(', ')}]`;
    }

    if (this.isObjectRecord(value)) {
      const entries = Object.entries(value)
        .map(([key, item]) => {
          const serializedValue = this.serializeTomlValue(item);
          if (!serializedValue) {
            return '';
          }
          return `${key} = ${serializedValue}`;
        })
        .filter(Boolean);
      return `{ ${entries.join(', ')} }`;
    }

    return null;
  }

  private serializeTomlMcpSection(
    serverName: string,
    config: Record<string, unknown>,
  ): string {
    const normalizedName = /^[A-Za-z0-9_-]+$/.test(serverName)
      ? serverName
      : `"${serverName.replace(/"/g, '\\"')}"`;
    const lines = [`[mcp_servers.${normalizedName}]`];

    for (const [key, value] of Object.entries(config)) {
      const serializedValue = this.serializeTomlValue(value);
      if (!serializedValue) {
        continue;
      }

      lines.push(`${key} = ${serializedValue}`);
    }

    return lines.join('\n');
  }

  private removeTomlMcpServer(content: string, serverName: string): string {
    const lines = content.split(/\r?\n/);
    const headerRegex = /^\s*\[(?:mcp_servers|mcpServers)\.([^\]]+)\]\s*$/;
    const skipLineIndexes = new Set<number>();

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const match = headerRegex.exec(line);
      if (!match?.[1]) {
        continue;
      }

      const name = this.normalizeTomlKeyOrSection(match[1]);
      if (name !== serverName) {
        continue;
      }

      let endIndex = index;
      while (endIndex + 1 < lines.length) {
        const nextLine = lines[endIndex + 1] ?? '';
        if (/^\s*\[.+\]\s*$/.test(nextLine)) {
          break;
        }
        endIndex += 1;
      }

      for (let lineIndex = index; lineIndex <= endIndex; lineIndex += 1) {
        skipLineIndexes.add(lineIndex);
      }
      break;
    }

    return lines
      .filter((_, index) => !skipLineIndexes.has(index))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  private upsertTomlMcpServers(
    content: string,
    updates: Record<string, Record<string, unknown>>,
  ): string {
    const lines = content.split(/\r?\n/);
    const headerRegex = /^\s*\[(?:mcp_servers|mcpServers)\.([^\]]+)\]\s*$/;
    const sectionRanges: Array<{ name: string; start: number; end: number }> =
      [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const match = headerRegex.exec(line);
      if (!match?.[1]) {
        continue;
      }

      const name = this.normalizeTomlKeyOrSection(match[1]);
      let endIndex = index;
      while (endIndex + 1 < lines.length) {
        const nextLine = lines[endIndex + 1] ?? '';
        if (/^\s*\[.+\]\s*$/.test(nextLine)) {
          break;
        }
        endIndex += 1;
      }

      sectionRanges.push({
        name,
        start: index,
        end: endIndex,
      });
      index = endIndex;
    }

    const skipLineIndexes = new Set<number>();
    for (const section of sectionRanges) {
      if (!Object.prototype.hasOwnProperty.call(updates, section.name)) {
        continue;
      }

      for (
        let lineIndex = section.start;
        lineIndex <= section.end;
        lineIndex += 1
      ) {
        skipLineIndexes.add(lineIndex);
      }
    }

    const baseLines = lines.filter((_, index) => !skipLineIndexes.has(index));
    const normalizedBaseText = baseLines.join('\n').trimEnd();
    const blocks = Object.entries(updates).map(([name, config]) =>
      this.serializeTomlMcpSection(name, config),
    );

    if (!normalizedBaseText) {
      return `${blocks.join('\n\n')}\n`;
    }

    return `${normalizedBaseText}\n\n${blocks.join('\n\n')}\n`;
  }
}
