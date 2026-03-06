import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import type { Express } from 'express';
import os from 'os';
import path from 'path';
import { Skill } from './domain/skill';
import { SkillRepository } from './infrastructure/persistence/skill.repository';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { FindAllSkillsDto } from './dto/find-all-skills.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';
import {
  buildSkillDirectoryTree,
  loadBusinessLineLocalSkills,
  loadProjectLocalSkillMarkdownContent,
  loadProjectLocalSkills,
  packSkillAsZip,
  readSkillFile,
  resolveProjectSkillRootForWrite,
  resolveSkillRootDirectory,
  type SkillTreeNode,
} from '../utils/local-agent-catalog';
import { GetSkillContentDto } from './dto/get-skill-content.dto';
import { SkillContentDto } from './dto/skill-content.dto';
import { CopyBusinessLineSkillDto } from './dto/copy-business-line-skill.dto';
import { UploadProjectLocalSkillDto } from './dto/upload-project-local-skill.dto';
import { ProjectLocalSkillResultDto } from './dto/project-local-skill-result.dto';
import {
  resolveAinativeDataRootDir,
  resolveWorkspaceRootDir,
} from '../utils/workspace-paths';

const workspaceRootDir = resolveWorkspaceRootDir();

@Injectable()
export class SkillsService {
  private static readonly MAX_SKILL_ARCHIVE_SIZE_BYTES = 20 * 1024 * 1024;
  private static readonly SKILL_UPLOAD_EXTENSIONS = new Set(['.zip']);
  private static readonly SKILL_UPLOAD_COMMAND_TIMEOUT_MS = 15_000;

  constructor(
    private readonly skillRepository: SkillRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(
    createSkillDto: CreateSkillDto,
    currentUser: JwtPayloadType,
  ): Promise<Skill> {
    this.ensureAdmin(currentUser);

    const existedSkill = await this.skillRepository.findByNameAndVersion({
      name: createSkillDto.name,
      version: createSkillDto.version,
    });

    if (existedSkill) {
      throw new ConflictException('Skill name and version already exists');
    }

    return this.skillRepository.create({
      name: createSkillDto.name,
      version: createSkillDto.version,
      description: createSkillDto.description ?? null,
      scope: createSkillDto.scope ?? null,
      homepageUrl: createSkillDto.homepageUrl ?? null,
      metadataJson: createSkillDto.metadataJson ?? null,
      enabled: createSkillDto.enabled ?? true,
    });
  }

  async findAllWithPagination(
    query: FindAllSkillsDto,
    currentUser: JwtPayloadType,
  ): Promise<Skill[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    if (query.projectId) {
      const project = await this.projectsService.assertCanAccessProject(
        query.projectId,
        currentUser,
      );
      const localSkills = await loadProjectLocalSkills(project);

      return this.filterAndPaginateLocalSkills(localSkills, query);
    }

    return this.skillRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      enabled: query.enabled,
    });
  }

  async findById(id: Skill['id']): Promise<Skill> {
    const skill = await this.skillRepository.findById(id);

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return skill;
  }

  async findProjectSkillContent(
    skillId: string,
    query: GetSkillContentDto,
    currentUser: JwtPayloadType,
  ): Promise<SkillContentDto> {
    const project = await this.projectsService.assertCanAccessProject(
      query.projectId,
      currentUser,
    );

    const skillContent = await loadProjectLocalSkillMarkdownContent(
      project,
      skillId,
    );

    if (!skillContent) {
      throw new NotFoundException('Skill content not found');
    }

    return skillContent;
  }

  async findProjectSkillTree(
    skillId: string,
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ id: string; name: string; tree: SkillTreeNode[] }> {
    const project = await this.projectsService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    const skills = await loadProjectLocalSkills(project);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const rootDir = resolveSkillRootDirectory(targetSkill);
    if (!rootDir) {
      throw new NotFoundException('Skill directory not found');
    }

    const tree = await buildSkillDirectoryTree(rootDir);

    return { id: targetSkill.id, name: targetSkill.name, tree };
  }

  async findProjectSkillFile(
    skillId: string,
    projectId: string,
    filePath: string,
    currentUser: JwtPayloadType,
  ): Promise<{ path: string; content: string }> {
    const project = await this.projectsService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    const skills = await loadProjectLocalSkills(project);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const rootDir = resolveSkillRootDirectory(targetSkill);
    if (!rootDir) {
      throw new NotFoundException('Skill directory not found');
    }

    const content = await readSkillFile(rootDir, filePath);
    if (content === null) {
      throw new NotFoundException('File not found');
    }

    return { path: filePath, content };
  }

  async downloadProjectSkill(
    skillId: string,
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const project = await this.projectsService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    const skills = await loadProjectLocalSkills(project);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const rootDir = resolveSkillRootDirectory(targetSkill);
    if (!rootDir) {
      throw new NotFoundException('Skill directory not found');
    }

    const buffer = await packSkillAsZip(rootDir);
    const safeName = this.toSafeSkillDirectoryName(targetSkill.name) || 'skill';

    return { buffer, fileName: `${safeName}.zip` };
  }

  async copyBusinessLineSkillToProject(
    dto: CopyBusinessLineSkillDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectLocalSkillResultDto> {
    const project = await this.projectsService.assertCanManageProject(
      dto.projectId,
      currentUser,
    );

    const businessLineSkills = await loadBusinessLineLocalSkills(
      project.businessLineId,
    );
    const sourceSkill = businessLineSkills.find(
      (item) => item.id === dto.businessLineSkillId,
    );

    if (!sourceSkill) {
      throw new NotFoundException('Business line skill not found');
    }

    const sourceSkillDirectory = await this.resolveBusinessLineSkillDirectory(
      project.businessLineId,
      sourceSkill,
    );
    if (!sourceSkillDirectory) {
      throw new NotFoundException(
        'Business line skill source directory not found',
      );
    }

    const targetRoot = await resolveProjectSkillRootForWrite(
      project,
      dto.provider,
    );
    if (!targetRoot) {
      throw new BadRequestException(
        'Project local skill directory is unavailable',
      );
    }

    await fs.mkdir(targetRoot.skillsPath, { recursive: true });

    const directoryName = this.toSafeSkillDirectoryName(sourceSkill.name);
    if (!directoryName) {
      throw new BadRequestException('Invalid skill name');
    }

    const targetSkillPath = path.join(targetRoot.skillsPath, directoryName);
    const existedStat = await this.safeStat(targetSkillPath);
    if (existedStat) {
      throw new ConflictException(
        `Skill directory already exists: ${directoryName}`,
      );
    }

    await fs.cp(sourceSkillDirectory, targetSkillPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });

    return {
      name: sourceSkill.name,
      description: sourceSkill.description ?? null,
      directoryName,
      provider: targetRoot.provider,
    };
  }

  async uploadProjectLocalSkill(
    query: UploadProjectLocalSkillDto,
    file: Express.Multer.File | undefined,
    currentUser: JwtPayloadType,
  ): Promise<ProjectLocalSkillResultDto> {
    const project = await this.projectsService.assertCanManageProject(
      query.projectId,
      currentUser,
    );

    if (!file?.buffer?.length) {
      throw new BadRequestException('Skill package file is required');
    }

    if (file.size > SkillsService.MAX_SKILL_ARCHIVE_SIZE_BYTES) {
      throw new BadRequestException(
        `Skill package size must be <= ${SkillsService.MAX_SKILL_ARCHIVE_SIZE_BYTES} bytes`,
      );
    }

    const normalizedName = file.originalname?.trim() ?? '';
    const extension = path.extname(normalizedName).toLowerCase();
    if (!SkillsService.SKILL_UPLOAD_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Only .zip package files are supported');
    }

    const targetRoot = await resolveProjectSkillRootForWrite(
      project,
      query.provider,
    );
    if (!targetRoot) {
      throw new BadRequestException(
        'Project local skill directory is unavailable',
      );
    }

    const temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-project-skill-upload-'),
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

      await fs.mkdir(targetRoot.skillsPath, { recursive: true });
      const targetSkillPath = path.join(
        targetRoot.skillsPath,
        targetSkillDirectoryName,
      );
      const sourceSkillPath = packageRoot.rootDirPath
        ? path.join(extractedPath, packageRoot.rootDirPath)
        : extractedPath;

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
        provider: targetRoot.provider,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
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

  async update(
    id: Skill['id'],
    updateSkillDto: UpdateSkillDto,
    currentUser: JwtPayloadType,
  ): Promise<Skill> {
    this.ensureAdmin(currentUser);

    const existedSkill = await this.skillRepository.findById(id);

    if (!existedSkill) {
      throw new NotFoundException('Skill not found');
    }

    const nextName = updateSkillDto.name ?? existedSkill.name;
    const nextVersion = updateSkillDto.version ?? existedSkill.version;

    if (
      nextName !== existedSkill.name ||
      nextVersion !== existedSkill.version
    ) {
      const duplicatedSkill = await this.skillRepository.findByNameAndVersion({
        name: nextName,
        version: nextVersion,
      });

      if (duplicatedSkill && duplicatedSkill.id !== id) {
        throw new ConflictException('Skill name and version already exists');
      }
    }

    const updatedSkill = await this.skillRepository.update(id, {
      ...(updateSkillDto.name !== undefined
        ? { name: updateSkillDto.name }
        : {}),
      ...(updateSkillDto.version !== undefined
        ? { version: updateSkillDto.version }
        : {}),
      ...(updateSkillDto.description !== undefined
        ? { description: updateSkillDto.description }
        : {}),
      ...(updateSkillDto.scope !== undefined
        ? { scope: updateSkillDto.scope }
        : {}),
      ...(updateSkillDto.homepageUrl !== undefined
        ? { homepageUrl: updateSkillDto.homepageUrl }
        : {}),
      ...(updateSkillDto.metadataJson !== undefined
        ? { metadataJson: updateSkillDto.metadataJson }
        : {}),
      ...(updateSkillDto.enabled !== undefined
        ? { enabled: updateSkillDto.enabled }
        : {}),
    });

    if (!updatedSkill) {
      throw new NotFoundException('Skill not found');
    }

    return updatedSkill;
  }

  async remove(id: Skill['id'], currentUser: JwtPayloadType): Promise<void> {
    this.ensureAdmin(currentUser);
    await this.findById(id);
    await this.skillRepository.remove(id);
  }

  async removeProjectLocalSkill(
    projectId: string,
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const project = await this.projectsService.assertCanManageProject(
      projectId,
      currentUser,
    );

    const skills = await loadProjectLocalSkills(project);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const sourcePath =
      targetSkill.metadataJson && typeof targetSkill.metadataJson === 'object'
        ? (targetSkill.metadataJson as Record<string, unknown>).sourcePath
        : null;

    if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
      throw new BadRequestException('Skill source path is unavailable');
    }

    const absoluteSourcePath = path.resolve(sourcePath.trim());

    const stat = await this.safeStat(absoluteSourcePath);
    const directoryToRemove = stat?.isDirectory()
      ? absoluteSourcePath
      : path.dirname(absoluteSourcePath);

    if (
      !this.isPathWithin(path.dirname(directoryToRemove), directoryToRemove)
    ) {
      throw new BadRequestException('Skill path is invalid');
    }

    const dirBasename = path.basename(path.dirname(directoryToRemove));
    if (dirBasename !== 'skills') {
      throw new BadRequestException(
        'Skill directory is not inside a skills folder',
      );
    }

    await fs.rm(directoryToRemove, { recursive: true, force: true });
  }

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!currentUser.roles?.includes('admin')) {
      throw new ForbiddenException('forbiddenSkillManage');
    }
  }

  private toAbsolutePath(targetPath: string): string {
    const normalizedPath = targetPath.trim();
    if (!normalizedPath) {
      return '';
    }

    if (path.isAbsolute(normalizedPath)) {
      return path.resolve(normalizedPath);
    }

    return path.resolve(workspaceRootDir, normalizedPath);
  }

  private isPathWithin(parentPath: string, targetPath: string): boolean {
    const resolvedParent = path.resolve(parentPath);
    const resolvedTarget = path.resolve(targetPath);
    const relativePath = path.relative(resolvedParent, resolvedTarget);

    if (!relativePath) {
      return true;
    }

    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  private isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
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
      }, SkillsService.SKILL_UPLOAD_COMMAND_TIMEOUT_MS);

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

  private async safeStat(
    targetPath: string,
  ): Promise<import('fs').Stats | null> {
    try {
      return await fs.stat(targetPath);
    } catch {
      return null;
    }
  }

  private resolveSkillSourcePath(skill: Skill): string | null {
    if (!this.isObjectRecord(skill.metadataJson)) {
      return null;
    }

    return this.normalizeOptionalText(skill.metadataJson.sourcePath);
  }

  private async resolveBusinessLineSkillDirectory(
    businessLineId: string,
    skill: Skill,
  ): Promise<string | null> {
    const sourcePath = this.resolveSkillSourcePath(skill);
    if (!sourcePath) {
      return null;
    }

    const businessLineSkillsRoot = path.resolve(
      resolveAinativeDataRootDir(),
      businessLineId,
      'skills',
    );
    const absoluteSourcePath = this.toAbsolutePath(sourcePath);
    if (!absoluteSourcePath) {
      return null;
    }

    if (!this.isPathWithin(businessLineSkillsRoot, absoluteSourcePath)) {
      return null;
    }

    const sourceStat = await this.safeStat(absoluteSourcePath);
    if (!sourceStat) {
      return null;
    }

    const sourceDirectoryPath = sourceStat.isDirectory()
      ? absoluteSourcePath
      : path.dirname(absoluteSourcePath);
    if (!this.isPathWithin(businessLineSkillsRoot, sourceDirectoryPath)) {
      return null;
    }

    const directoryStat = await this.safeStat(sourceDirectoryPath);
    if (!directoryStat?.isDirectory()) {
      return null;
    }

    return sourceDirectoryPath;
  }

  private filterAndPaginateLocalSkills(
    skills: Skill[],
    query: FindAllSkillsDto,
  ): Skill[] {
    const keyword = query.keyword?.trim().toLowerCase() ?? '';
    const filtered = skills.filter((skill) => {
      if (query.enabled !== undefined && skill.enabled !== query.enabled) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const targetText =
        `${skill.name} ${skill.version} ${skill.description ?? ''}`
          .toLowerCase()
          .trim();

      return targetText.includes(keyword);
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    return filtered.slice(offset, offset + limit);
  }
}
