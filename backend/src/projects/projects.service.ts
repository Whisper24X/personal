import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectMemberRepository } from './infrastructure/persistence/project-member.repository';
import { Project } from './domain/project';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLineMemberRepository } from '../business-lines/infrastructure/persistence/business-line-member.repository';
import { BusinessLineMemberRole } from '../business-lines/dto/business-line-member-role.enum';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { FindAllProjectsDto } from './dto/find-all-projects.dto';
import { ProjectMember } from './domain/project-member';
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import {
  InspectProjectRepositoryDto,
  ProjectRepositoryInspectionDto,
} from './dto/inspect-project-repository.dto';
import {
  QueryProjectDocsDto,
  QueryProjectDocsResponseDto,
  SaveProjectDocDto,
} from './dto/project-doc.dto';
import { UsersService } from '../users/users.service';
import { ProjectMemberRole } from './dto/project-member-role.enum';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';

@Injectable()
export class ProjectsService {
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly maxProjectDocFiles = 500;
  private readonly maxProjectDocDepth = 8;
  private readonly maxQueryContextChars = 24_000;
  private readonly maxQueryDocSnippetChars = 1_600;
  private readonly defaultQueryTimeoutMs = 120_000;
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
  );

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly usersService: UsersService,
    private readonly taskRepository: TaskRepository,
    private readonly configService: ConfigService = new ConfigService(),
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    await this.ensureCanManageBusinessLine(
      createProjectDto.businessLineId,
      currentUser,
    );

    const existedProject =
      await this.projectRepository.findByBusinessLineIdAndName(
        createProjectDto.businessLineId,
        createProjectDto.name,
      );

    if (existedProject) {
      throw new ConflictException(
        'Project name already exists in business line',
      );
    }

    await this.validateGitRepositoryAccessible(createProjectDto.gitUrl);

    let project: Project;

    try {
      project = await this.projectRepository.create({
        businessLineId: createProjectDto.businessLineId,
        name: createProjectDto.name,
        description: createProjectDto.description ?? null,
        gitUrl: createProjectDto.gitUrl,
        defaultBranch: createProjectDto.defaultBranch ?? 'main',
        configJson: createProjectDto.configJson ?? null,
      });
    } catch (error) {
      throw this.mapDatabaseErrorToHttpException(
        error,
        'Failed to create project',
      );
    }

    try {
      await this.ensureProjectRepository(project);
    } catch (error) {
      await this.rollbackCreatedProject(project.id);
      throw new BadRequestException(
        this.formatGitSyncFailureMessage(error, project.gitUrl),
      );
    }

    const userId = currentUser?.sub;
    if (!userId) {
      await this.rollbackCreatedProject(project.id);
      throw new BadRequestException('Invalid user session');
    }

    const existedCreatorMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        userId,
      );

    if (!existedCreatorMember) {
      try {
        await this.projectMemberRepository.create({
          projectId: project.id,
          userId,
          role: ProjectMemberRole.owner,
        });
      } catch (error) {
        await this.rollbackCreatedProject(project.id);
        throw this.mapDatabaseErrorToHttpException(
          error,
          'Failed to add project owner',
        );
      }
    }

    return project;
  }

  private mapDatabaseErrorToHttpException(
    error: unknown,
    context: string,
  ): BadRequestException | ConflictException | InternalServerErrorException {
    if (error instanceof QueryFailedError) {
      const pgError = error as QueryFailedError & { code?: string };
      const code = pgError.code;

      if (code === '23503') {
        return new BadRequestException(
          `${context}: Referenced record not found (e.g. business line or user does not exist)`,
        );
      }

      if (code === '23505') {
        return new ConflictException(
          `${context}: Duplicate entry (e.g. project name already exists)`,
        );
      }
    }

    const message =
      error instanceof Error ? error.message : 'Unknown database error';
    return new InternalServerErrorException(
      `${context}: ${this.truncateError(message)}`,
    );
  }

  async inspectRepository(
    inspectProjectRepositoryDto: InspectProjectRepositoryDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectRepositoryInspectionDto> {
    await this.ensureCanManageBusinessLine(
      inspectProjectRepositoryDto.businessLineId,
      currentUser,
    );

    const gitUrl = inspectProjectRepositoryDto.gitUrl.trim();
    const result = await this.runCommand('git', [
      'ls-remote',
      '--heads',
      '--refs',
      gitUrl,
    ]);

    if (!result.success) {
      throw new BadRequestException(
        `Git repository is unreachable or unauthorized: ${this.truncateError(result.stderr)}`,
      );
    }

    const branches = this.sortBranches(this.parseRemoteBranches(result.stdout));
    const recommendedDefaultBranch =
      this.resolveRecommendedDefaultBranch(branches);

    return {
      repoName: this.extractRepositoryName(gitUrl) ?? 'repository',
      branches,
      recommendedDefaultBranch,
    };
  }

  async findAllWithPagination({
    currentUser,
    query,
  }: {
    currentUser: JwtPayloadType;
    query: FindAllProjectsDto;
  }): Promise<Project[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    if (this.isAdmin(currentUser)) {
      return this.projectRepository.findAllWithPagination({
        paginationOptions,
        businessLineId: query.businessLineId,
        keyword: query.keyword,
      });
    }

    const [projectMemberships, businessLineMemberships] = await Promise.all([
      this.projectMemberRepository.findByUserId(currentUser.sub),
      this.businessLineMemberRepository.findByUserId(currentUser.sub),
    ]);

    const accessibleProjectIds = projectMemberships.map(
      (membership) => membership.projectId,
    );

    const manageableBusinessLineIds = businessLineMemberships
      .filter(
        (membership) =>
          membership.role === BusinessLineMemberRole.owner ||
          membership.role === BusinessLineMemberRole.admin,
      )
      .map((membership) => membership.businessLineId);

    return this.projectRepository.findAccessibleWithPagination({
      paginationOptions,
      projectIds: accessibleProjectIds,
      businessLineIds: manageableBusinessLineIds,
      keyword: query.keyword,
      businessLineId: query.businessLineId,
    });
  }

  async findById(
    id: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project | null> {
    return this.ensureCanAccessProject(id, currentUser);
  }

  async update(
    id: Project['id'],
    updateProjectDto: UpdateProjectDto,
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const currentProject = await this.ensureCanManageProject(id, currentUser);

    const nextBusinessLineId =
      updateProjectDto.businessLineId ?? currentProject.businessLineId;

    if (updateProjectDto.businessLineId) {
      await this.ensureCanManageBusinessLine(
        updateProjectDto.businessLineId,
        currentUser,
      );
    }

    if (updateProjectDto.name) {
      const existedProject =
        await this.projectRepository.findByBusinessLineIdAndName(
          nextBusinessLineId,
          updateProjectDto.name,
        );

      if (existedProject && existedProject.id !== id) {
        throw new ConflictException(
          'Project name already exists in business line',
        );
      }
    }

    const updatedProject = await this.projectRepository.update(id, {
      ...(updateProjectDto.name !== undefined
        ? { name: updateProjectDto.name }
        : {}),
      ...(updateProjectDto.description !== undefined
        ? { description: updateProjectDto.description }
        : {}),
      ...(updateProjectDto.gitUrl !== undefined
        ? { gitUrl: updateProjectDto.gitUrl }
        : {}),
      ...(updateProjectDto.defaultBranch !== undefined
        ? { defaultBranch: updateProjectDto.defaultBranch }
        : {}),
      ...(updateProjectDto.configJson !== undefined
        ? { configJson: updateProjectDto.configJson }
        : {}),
      ...(updateProjectDto.businessLineId !== undefined
        ? { businessLineId: updateProjectDto.businessLineId }
        : {}),
    });

    if (!updatedProject) {
      throw new NotFoundException('Project not found');
    }

    if (updatedProject.businessLineId !== currentProject.businessLineId) {
      await this.taskRepository.bulkUpdateBusinessLineIdByProjectId({
        projectId: updatedProject.id,
        businessLineId: updatedProject.businessLineId,
      });
    }

    return updatedProject;
  }

  async remove(id: Project['id'], currentUser: JwtPayloadType): Promise<void> {
    await this.ensureCanManageProject(id, currentUser);
    await this.projectRepository.remove(id);
  }

  async findMembers(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectMember[]> {
    await this.ensureCanAccessProject(projectId, currentUser);

    return this.projectMemberRepository.findByProjectId(projectId);
  }

  async addMember(
    projectId: Project['id'],
    createProjectMemberDto: CreateProjectMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectMember> {
    const manageContext = await this.ensureCanManageProjectMembers(
      projectId,
      currentUser,
    );

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorProjectMember: manageContext.actorProjectMember,
      byBusinessLinePermission: manageContext.byBusinessLinePermission,
      nextRole: createProjectMemberDto.role,
    });

    const existedMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        createProjectMemberDto.userId,
      );

    if (existedMember) {
      throw new ConflictException('Member already exists in project');
    }

    const user = await this.usersService.findById(
      createProjectMemberDto.userId,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const businessLineMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        manageContext.project.businessLineId,
        createProjectMemberDto.userId,
      );

    if (!businessLineMember) {
      throw new ConflictException(
        'User is not a member of project business line',
      );
    }

    return this.projectMemberRepository.create({
      projectId,
      userId: createProjectMemberDto.userId,
      role: createProjectMemberDto.role,
    });
  }

  async updateMemberRole(
    projectId: Project['id'],
    userId: string,
    updateProjectMemberDto: UpdateProjectMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectMember> {
    const manageContext = await this.ensureCanManageProjectMembers(
      projectId,
      currentUser,
    );

    const targetMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        userId,
      );

    if (!targetMember) {
      throw new NotFoundException('Project member not found');
    }

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorProjectMember: manageContext.actorProjectMember,
      byBusinessLinePermission: manageContext.byBusinessLinePermission,
      targetMember,
      nextRole: updateProjectMemberDto.role,
    });

    if (
      targetMember.role === ProjectMemberRole.owner &&
      updateProjectMemberDto.role !== ProjectMemberRole.owner
    ) {
      this.ensureOwnerSelfProtection(
        targetMember,
        currentUser,
        manageContext.byBusinessLinePermission,
      );
      await this.ensureOwnerCanBeModified(projectId);
    }

    const updatedMember = await this.projectMemberRepository.update(
      projectId,
      userId,
      {
        role: updateProjectMemberDto.role,
      },
    );

    if (!updatedMember) {
      throw new NotFoundException('Project member not found');
    }

    return updatedMember;
  }

  async removeMember(
    projectId: Project['id'],
    userId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const manageContext = await this.ensureCanManageProjectMembers(
      projectId,
      currentUser,
    );

    const targetMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        userId,
      );

    if (!targetMember) {
      throw new NotFoundException('Project member not found');
    }

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorProjectMember: manageContext.actorProjectMember,
      byBusinessLinePermission: manageContext.byBusinessLinePermission,
      targetMember,
    });

    if (targetMember.role === ProjectMemberRole.owner) {
      this.ensureOwnerSelfProtection(
        targetMember,
        currentUser,
        manageContext.byBusinessLinePermission,
      );
      await this.ensureOwnerCanBeModified(projectId);
    }

    await this.projectMemberRepository.remove(projectId, userId);
  }

  async assertCanAccessProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.ensureCanAccessProject(projectId, currentUser);
  }

  async assertCanManageProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.ensureCanManageProject(projectId, currentUser);
  }

  async ensureProjectRepositoryReady(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<{ project: Project; repositoryRoot: string }> {
    const project = await this.ensureCanAccessProject(projectId, currentUser);

    try {
      const repositoryRoot = await this.ensureProjectRepository(project);
      return {
        project,
        repositoryRoot,
      };
    } catch (error) {
      throw new BadRequestException(
        this.formatGitSyncFailureMessage(error, project.gitUrl),
      );
    }
  }

  async listDocs(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<
    Array<{ path: string; name: string; size: number; updatedAt: Date }>
  > {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);
    if (!docsRootExists) {
      return [];
    }

    const results: Array<{
      path: string;
      name: string;
      size: number;
      updatedAt: Date;
    }> = [];

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > this.maxProjectDocDepth || results.length >= this.maxProjectDocFiles) {
        return;
      }

      let entries: Array<{
        name: string;
        isDirectory: () => boolean;
        isFile: () => boolean;
      }>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        if (results.length >= this.maxProjectDocFiles) {
          return;
        }

        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath, depth + 1);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const stat = await fs.stat(absolutePath).catch(() => null);
        if (!stat?.isFile()) {
          continue;
        }

        const relativePath = path.relative(docsRoot, absolutePath).split(path.sep).join('/');
        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          continue;
        }

        results.push({
          path: relativePath,
          name: path.basename(absolutePath),
          size: stat.size,
          updatedAt: stat.mtime,
        });
      }
    };

    await walk(docsRoot, 0);
    return results.sort((left, right) => left.path.localeCompare(right.path));
  }

  async readDoc(
    projectId: Project['id'],
    rawDocPath: string,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(rawDocPath);
    const absolutePath = this.resolveProjectDocAbsolutePath(docsRoot, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);

    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    const content = await fs.readFile(absolutePath, 'utf-8');

    return {
      path: relativePath,
      name: path.basename(absolutePath),
      size: stat.size,
      updatedAt: stat.mtime,
      content,
    };
  }

  async createDoc(
    projectId: Project['id'],
    payload: SaveProjectDocDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(payload.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(docsRoot, relativePath);

    const existed = await this.pathExists(absolutePath);
    if (existed) {
      throw new ConflictException('Project doc already exists');
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, payload.content ?? '', 'utf-8');

    return this.readDoc(projectId, relativePath, currentUser);
  }

  async updateDoc(
    projectId: Project['id'],
    payload: SaveProjectDocDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(payload.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(docsRoot, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    await fs.writeFile(absolutePath, payload.content ?? '', 'utf-8');
    return this.readDoc(projectId, relativePath, currentUser);
  }

  async removeDoc(
    projectId: Project['id'],
    rawDocPath: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(rawDocPath);
    const absolutePath = this.resolveProjectDocAbsolutePath(docsRoot, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    await fs.unlink(absolutePath);
  }

  async queryDocs(
    projectId: Project['id'],
    payload: QueryProjectDocsDto,
    currentUser: JwtPayloadType,
  ): Promise<QueryProjectDocsResponseDto> {
    const startAt = Date.now();
    const { project, repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);

    if (!docsRootExists) {
      return {
        answer: '当前项目还没有 docs 文档，无法执行知识问答。请先上传或创建文档。',
        citations: [],
        durationMs: Date.now() - startAt,
      };
    }

    const normalizedQuestion = payload.question.trim();
    const maxContextDocs = Math.max(1, Math.min(payload.maxContextDocs ?? 6, 20));
    const candidateDocs = await this.selectCandidateDocs({
      projectId,
      docsRoot,
      question: normalizedQuestion,
      maxContextDocs,
      scope: payload.scope ?? 'project',
      currentPath: payload.currentPath,
      currentUser,
    });

    if (!candidateDocs.length) {
      return {
        answer: '没有检索到相关文档内容。建议换个问法，或补充更明确的关键词。',
        citations: [],
        durationMs: Date.now() - startAt,
      };
    }

    const citations = candidateDocs.map((doc) => ({
      path: doc.path,
      snippet: this.buildCitationSnippet(doc.content),
    }));

    const prompt = this.buildKnowledgeQueryPrompt({
      question: normalizedQuestion,
      docs: candidateDocs,
    });

    const agentResult = await this.executeKnowledgeAgent({
      project,
      repositoryRoot,
      prompt,
      onChunk: undefined,
    });

    const answer =
      agentResult.success && agentResult.stdout.trim()
        ? agentResult.stdout.trim()
        : this.buildFallbackAnswer(citations, agentResult.stderr);

    return {
      answer,
      citations,
      durationMs: Date.now() - startAt,
      traceId: `docs-query-${projectId}-${Date.now()}`,
    };
  }

  async streamDocsQuery(
    projectId: Project['id'],
    payload: QueryProjectDocsDto,
    currentUser: JwtPayloadType,
    emit: (event: string, data: unknown) => void,
  ): Promise<void> {
    const startAt = Date.now();
    const { project, repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);

    if (!docsRootExists) {
      emit('error', {
        message: '当前项目还没有 docs 文档，无法执行知识问答。',
      });
      emit('done', {
        durationMs: Date.now() - startAt,
      });
      return;
    }

    const normalizedQuestion = payload.question.trim();
    const maxContextDocs = Math.max(1, Math.min(payload.maxContextDocs ?? 6, 20));
    const candidateDocs = await this.selectCandidateDocs({
      projectId,
      docsRoot,
      question: normalizedQuestion,
      maxContextDocs,
      scope: payload.scope ?? 'project',
      currentPath: payload.currentPath,
      currentUser,
    });

    if (!candidateDocs.length) {
      emit('error', {
        message: '没有检索到相关文档内容。建议换个问法，或补充更明确的关键词。',
      });
      emit('done', {
        durationMs: Date.now() - startAt,
      });
      return;
    }

    const citations = candidateDocs.map((doc) => ({
      path: doc.path,
      snippet: this.buildCitationSnippet(doc.content),
    }));

    const prompt = this.buildKnowledgeQueryPrompt({
      question: normalizedQuestion,
      docs: candidateDocs,
    });

    const agentResult = await this.executeKnowledgeAgent({
      project,
      repositoryRoot,
      prompt,
      onChunk: (chunk) => {
        if (!chunk.trim()) {
          return;
        }
        emit('chunk', { delta: chunk });
      },
    });

    if (!agentResult.success && !agentResult.stdout.trim()) {
      emit('chunk', {
        delta: this.buildFallbackAnswer(citations, agentResult.stderr),
      });
    }

    emit('citations', { citations });
    emit('done', {
      durationMs: Date.now() - startAt,
      traceId: `docs-query-${projectId}-${Date.now()}`,
    });
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async selectCandidateDocs({
    projectId,
    docsRoot,
    question,
    maxContextDocs,
    scope,
    currentPath,
    currentUser,
  }: {
    projectId: string;
    docsRoot: string;
    question: string;
    maxContextDocs: number;
    scope: 'project' | 'current_doc';
    currentPath?: string;
    currentUser: JwtPayloadType;
  }): Promise<Array<{ path: string; content: string }>> {
    const docs = await this.listDocs(projectId, currentUser);
    if (!docs.length) {
      return [];
    }

    const normalizedCurrentPath = currentPath
      ? this.normalizeProjectDocPath(currentPath)
      : null;
    const tokens = this.extractQueryTokens(question);

    const scored = docs.map((doc) => {
      let score = 0;
      const lowerPath = doc.path.toLowerCase();

      for (const token of tokens) {
        if (lowerPath.includes(token)) {
          score += 3;
        }
      }

      if (normalizedCurrentPath && doc.path === normalizedCurrentPath) {
        score += 100;
      }

      return { doc, score };
    });

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.doc.path.localeCompare(right.doc.path);
    });

    const picked = scored
      .filter((item, index) => {
        if (scope === 'current_doc' && normalizedCurrentPath) {
          if (item.doc.path === normalizedCurrentPath) {
            return true;
          }

          return index < Math.max(2, Math.floor(maxContextDocs / 2));
        }

        return true;
      })
      .slice(0, maxContextDocs)
      .map((item) => item.doc);

    const contexts: Array<{ path: string; content: string }> = [];
    let totalChars = 0;

    for (const doc of picked) {
      const absolutePath = this.resolveProjectDocAbsolutePath(docsRoot, doc.path);
      const rawContent = await fs.readFile(absolutePath, 'utf-8').catch(() => '');
      if (!rawContent.trim()) {
        continue;
      }

      const clipped = rawContent.slice(0, this.maxQueryDocSnippetChars);
      if (totalChars + clipped.length > this.maxQueryContextChars) {
        break;
      }

      contexts.push({
        path: doc.path,
        content: clipped,
      });
      totalChars += clipped.length;
    }

    return contexts;
  }

  private extractQueryTokens(question: string): string[] {
    const rawTokens = question
      .toLowerCase()
      .split(/[\s,，。！？!?:：;；、/\\|()[\]{}"'`]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);

    return Array.from(new Set(rawTokens)).slice(0, 12);
  }

  private buildCitationSnippet(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 220)}...`;
  }

  private buildKnowledgeQueryPrompt({
    question,
    docs,
  }: {
    question: string;
    docs: Array<{ path: string; content: string }>;
  }): string {
    const contextBlocks = docs.map((doc, index) => {
      return [
        `## Document ${index + 1}`,
        `Path: ${doc.path}`,
        'Content:',
        doc.content,
      ].join('\n');
    });

    return [
      'You are an assistant for project docs Q&A.',
      'Use ONLY the provided document content to answer.',
      'If the answer is not in the docs, explicitly say you do not know.',
      'Keep the answer concise and in Chinese.',
      'At the end, include a short "References" section listing used paths.',
      '',
      `Question: ${question}`,
      '',
      'Context documents:',
      ...contextBlocks,
    ].join('\n');
  }

  private async executeKnowledgeAgent({
    project,
    repositoryRoot,
    prompt,
    onChunk,
  }: {
    project: Project;
    repositoryRoot: string;
    prompt: string;
    onChunk?: (chunk: string) => void;
  }): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const projectConfig =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};
    const adapter =
      typeof projectConfig.agentAdapter === 'string'
        ? projectConfig.agentAdapter.trim().toLowerCase()
        : 'codex';

    const command =
      typeof process.env.AINATIVE_CODEX_RUNNER_COMMAND === 'string' &&
      process.env.AINATIVE_CODEX_RUNNER_COMMAND.trim()
        ? process.env.AINATIVE_CODEX_RUNNER_COMMAND.trim()
        : adapter === 'cursor'
          ? 'agent'
          : 'codex';
    const args =
      adapter === 'cursor'
        ? ['-p', '--trust', '--force', prompt]
        : ['exec', '--skip-git-repo-check', '-'];

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: repositoryRoot,
        env: process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutRef = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, this.defaultQueryTimeoutMs);

      child.stdout?.on('data', (chunk) => {
        const text = chunk.toString('utf-8');
        stdout += text;
        onChunk?.(text);
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      child.on('error', (error) => {
        clearTimeout(timeoutRef);
        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
        });
      });

      if (adapter !== 'cursor') {
        child.stdin?.write(prompt);
        child.stdin?.end();
      }

      child.on('close', (code) => {
        clearTimeout(timeoutRef);
        resolve({
          success: !timedOut && code === 0,
          stdout: stdout.trim(),
          stderr: timedOut
            ? 'Agent execution timed out'
            : stderr.trim() || `Agent exit code ${code ?? 'null'}`,
        });
      });
    });
  }

  private buildFallbackAnswer(
    citations: Array<{ path: string; snippet: string }>,
    errorMessage: string,
  ): string {
    const lines = [
      '当前未能成功调用 Agent 生成答案，已返回候选文档摘要供参考。',
      `原因：${errorMessage || '未知错误'}`,
      '',
      '你可以根据以下内容手动判断，或重试提问：',
      ...citations.slice(0, 4).map((item) => `- ${item.path}: ${item.snippet}`),
    ];

    return lines.join('\n');
  }

  private async ensureCanAccessProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    let project: Project | null;

    try {
      project = await this.projectRepository.findById(projectId);
    } catch (error) {
      throw this.mapDatabaseErrorToHttpException(
        error,
        'Failed to load project',
      );
    }

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return project;
    }

    let projectMember;
    let businessLineMember;

    try {
      [projectMember, businessLineMember] = await Promise.all([
        this.projectMemberRepository.findByProjectIdAndUserId(
          project.id,
          currentUser.sub,
        ),
        this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
          project.businessLineId,
          currentUser.sub,
        ),
      ]);
    } catch (error) {
      throw this.mapDatabaseErrorToHttpException(
        error,
        'Failed to verify project access',
      );
    }

    if (projectMember) {
      return project;
    }

    if (
      businessLineMember &&
      (businessLineMember.role === BusinessLineMemberRole.owner ||
        businessLineMember.role === BusinessLineMemberRole.admin)
    ) {
      return project;
    }

    throw new ForbiddenException(
      'You do not have access to this project. Please ensure you are a project member or business line admin.',
    );
  }

  private async ensureCanManageProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return project;
    }

    const [projectMember, businessLineMember] = await Promise.all([
      this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      ),
      this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        project.businessLineId,
        currentUser.sub,
      ),
    ]);

    if (
      businessLineMember &&
      (businessLineMember.role === BusinessLineMemberRole.owner ||
        businessLineMember.role === BusinessLineMemberRole.admin)
    ) {
      return project;
    }

    if (
      projectMember &&
      (projectMember.role === ProjectMemberRole.owner ||
        projectMember.role === ProjectMemberRole.maintainer)
    ) {
      return project;
    }

    throw new ForbiddenException('forbiddenProjectManage');
  }

  private async ensureCanManageProjectMembers(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<{
    project: Project;
    actorProjectMember: ProjectMember | null;
    byBusinessLinePermission: boolean;
  }> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return {
        project,
        actorProjectMember: null,
        byBusinessLinePermission: false,
      };
    }

    const [projectMember, businessLineMember] = await Promise.all([
      this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      ),
      this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        project.businessLineId,
        currentUser.sub,
      ),
    ]);

    const byBusinessLinePermission =
      !!businessLineMember &&
      (businessLineMember.role === BusinessLineMemberRole.owner ||
        businessLineMember.role === BusinessLineMemberRole.admin);

    if (byBusinessLinePermission) {
      return {
        project,
        actorProjectMember: projectMember,
        byBusinessLinePermission: true,
      };
    }

    if (
      projectMember &&
      (projectMember.role === ProjectMemberRole.owner ||
        projectMember.role === ProjectMemberRole.maintainer)
    ) {
      return {
        project,
        actorProjectMember: projectMember,
        byBusinessLinePermission: false,
      };
    }

    throw new ForbiddenException('forbiddenProjectManage');
  }

  private ensureActorCanManageMemberMutation({
    currentUser,
    actorProjectMember,
    byBusinessLinePermission,
    targetMember,
    nextRole,
  }: {
    currentUser: JwtPayloadType;
    actorProjectMember: ProjectMember | null;
    byBusinessLinePermission: boolean;
    targetMember?: ProjectMember;
    nextRole?: ProjectMemberRole;
  }): void {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (byBusinessLinePermission) {
      return;
    }

    if (!actorProjectMember) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (actorProjectMember.role === ProjectMemberRole.owner) {
      return;
    }

    if (actorProjectMember.role !== ProjectMemberRole.maintainer) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (targetMember?.role === ProjectMemberRole.owner) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (nextRole === ProjectMemberRole.owner) {
      throw new ForbiddenException('forbiddenProjectManage');
    }
  }

  private async ensureCanManageBusinessLine(
    businessLineId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    if (this.isAdmin(currentUser)) {
      return;
    }

    const businessLineMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!businessLineMember) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    if (
      businessLineMember.role !== BusinessLineMemberRole.owner &&
      businessLineMember.role !== BusinessLineMemberRole.admin
    ) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }
  }

  private async validateGitRepositoryAccessible(gitUrl: string): Promise<void> {
    const result = await this.runCommand('git', [
      'ls-remote',
      '--heads',
      '--tags',
      gitUrl,
    ]);

    if (result.success) {
      return;
    }

    throw new BadRequestException(
      `Git repository is unreachable or unauthorized: ${this.truncateError(result.stderr)}`,
    );
  }

  private async ensureProjectRepository(project: Project): Promise<string> {
    const repositoryRoot = this.resolveRepositoryRoot(project);
    const gitDirPath = path.join(repositoryRoot, '.git');
    const hasGit = await this.pathExists(gitDirPath);

    if (!hasGit) {
      try {
        await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });
      } catch (mkdirError) {
        const msg =
          mkdirError instanceof Error ? mkdirError.message : 'Unknown error';
        throw new Error(
          `Cannot create project repository directory: ${this.truncateError(msg)}`,
        );
      }

      const cloneResult = await this.runCommand('git', [
        'clone',
        '--origin',
        'origin',
        project.gitUrl,
        repositoryRoot,
      ]);

      if (!cloneResult.success) {
        throw new Error(
          cloneResult.stderr || `git clone failed for ${project.gitUrl}`,
        );
      }
    } else {
      const setUrlResult = await this.runCommand('git', [
        '-C',
        repositoryRoot,
        'remote',
        'set-url',
        'origin',
        project.gitUrl,
      ]);

      if (!setUrlResult.success) {
        throw new Error(setUrlResult.stderr || 'git remote set-url failed');
      }
    }

    const fetchResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'fetch',
      '--all',
      '--prune',
    ]);

    if (!fetchResult.success) {
      throw new Error(fetchResult.stderr || 'git fetch failed');
    }

    return repositoryRoot;
  }

  private resolveRepositoryRoot(project: Project): string {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.repoLocalPath === 'string' &&
      config.repoLocalPath.trim()
    ) {
      return path.resolve(config.repoLocalPath.trim());
    }

    const cacheBaseDir =
      typeof config.repoCacheBaseDir === 'string' &&
      config.repoCacheBaseDir.trim()
        ? config.repoCacheBaseDir.trim()
        : this.configService
            .get<string>('AINATIVE_REPO_CACHE_BASE_DIR', { infer: true })
            ?.trim();

    const repositoryDirName = this.resolveRepositoryDirectoryName(project);

    if (!cacheBaseDir) {
      return path.join(
        this.resolveProjectStorageBaseDir(project),
        repositoryDirName,
      );
    }

    return path.resolve(cacheBaseDir, `${repositoryDirName}-${project.id}`);
  }

  private normalizeProjectDocPath(value: string): string {
    const raw = value?.trim();
    if (!raw) {
      throw new BadRequestException('Project doc path is required');
    }

    if (path.isAbsolute(raw)) {
      throw new BadRequestException('Absolute path is not allowed');
    }

    const normalized = path
      .normalize(raw.replace(/\\/g, '/'))
      .replace(/^\.(?:[\\/]|$)/, '')
      .replace(/[\\/]+$/, '');

    if (!normalized || normalized === '.') {
      throw new BadRequestException('Project doc path is required');
    }

    const pathSegments = normalized.split(path.sep);
    if (pathSegments.some((segment) => segment === '..')) {
      throw new BadRequestException('Project doc path cannot escape docs root');
    }

    return pathSegments.join('/');
  }

  private resolveProjectDocAbsolutePath(
    docsRoot: string,
    relativePath: string,
  ): string {
    const resolvedDocsRoot = path.resolve(docsRoot);
    const absolutePath = path.resolve(resolvedDocsRoot, relativePath);
    const relative = path.relative(resolvedDocsRoot, absolutePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Project doc path cannot escape docs root');
    }

    return absolutePath;
  }

  private resolveProjectStorageBaseDir(project: Project): string {
    const businessLineId =
      project.businessLineId?.trim() || 'unknown-business-line';
    const projectId = project.id?.trim() || 'unknown-project';

    return path.resolve(
      this.defaultDataRootDir,
      businessLineId,
      'projects',
      projectId,
    );
  }

  private resolveRepositoryDirectoryName(project: Project): string {
    const parsedFromGitUrl = this.extractRepositoryName(project.gitUrl);
    if (parsedFromGitUrl) {
      return parsedFromGitUrl;
    }

    const projectSegment = this.sanitizeSegment(project.name) || 'project';
    return projectSegment;
  }

  private extractRepositoryName(gitUrl: string): string | null {
    const trimmedUrl = gitUrl.trim();
    if (!trimmedUrl) {
      return null;
    }

    const withoutQuery = trimmedUrl.replace(/[?#].*$/, '').replace(/\/+$/, '');
    const lastSeparatorIndex = Math.max(
      withoutQuery.lastIndexOf('/'),
      withoutQuery.lastIndexOf(':'),
    );
    const rawName =
      lastSeparatorIndex >= 0
        ? withoutQuery.slice(lastSeparatorIndex + 1)
        : withoutQuery;
    const withoutGitSuffix = rawName.replace(/\.git$/i, '');
    const normalized = this.sanitizeSegment(withoutGitSuffix);

    return normalized || null;
  }

  private parseRemoteBranches(stdout: string): string[] {
    const branchNames = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[1] ?? '')
      .map((ref) => ref.replace(/^refs\/heads\//, ''))
      .filter(Boolean);

    return Array.from(new Set(branchNames));
  }

  private sortBranches(branches: string[]): string[] {
    return [...new Set(branches)].sort((left, right) => {
      const priorityDiff =
        this.resolveBranchPriority(left) - this.resolveBranchPriority(right);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.localeCompare(right);
    });
  }

  private resolveBranchPriority(branch: string): number {
    if (branch === 'master') {
      return 0;
    }

    if (branch === 'main') {
      return 1;
    }

    return 2;
  }

  private resolveRecommendedDefaultBranch(branches: string[]): string | null {
    if (branches.includes('master')) {
      return 'master';
    }

    if (branches.includes('main')) {
      return 'main';
    }

    return branches[0] ?? null;
  }

  private sanitizeSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async rollbackCreatedProject(projectId: string): Promise<void> {
    try {
      await this.projectRepository.remove(projectId);
    } catch {
      // Keep original error from git sync path.
    }
  }

  private formatGitSyncFailureMessage(error: unknown, gitUrl: string): string {
    if (error instanceof BadRequestException) {
      return String(error.message);
    }

    if (error instanceof Error) {
      return `Failed to sync repository for ${gitUrl}: ${this.truncateError(error.message)}`;
    }

    return `Failed to sync repository for ${gitUrl}`;
  }

  private truncateError(message: string): string {
    const normalized = message.trim();
    if (!normalized) {
      return 'Unknown git error';
    }

    if (normalized.length <= 500) {
      return normalized;
    }

    return `${normalized.slice(0, 500)}...`;
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
      }, this.defaultGitTimeoutMs);

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

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureOwnerCanBeModified(projectId: string): Promise<void> {
    const members =
      await this.projectMemberRepository.findByProjectId(projectId);

    const ownerCount = members.filter(
      (member) => member.role === ProjectMemberRole.owner,
    ).length;

    if (ownerCount <= 1) {
      throw new ConflictException('At least one project owner is required');
    }
  }

  private ensureOwnerSelfProtection(
    targetMember: ProjectMember,
    currentUser: JwtPayloadType,
    byBusinessLinePermission: boolean,
  ): void {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (byBusinessLinePermission) {
      return;
    }

    if (targetMember.userId === currentUser.sub) {
      throw new ConflictException(
        'Project owner cannot remove or downgrade self',
      );
    }
  }
}
