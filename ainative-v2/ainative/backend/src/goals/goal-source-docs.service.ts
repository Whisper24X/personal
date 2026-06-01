import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import extractZip from 'extract-zip';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { GitService } from '../git/git.service';
import { ProjectDocsService } from '../projects/project-docs.service';
import { ProjectsService } from '../projects/projects.service';
import { Goal } from './domain/goal';
import { AddSourceDocDto } from './dto/add-source-doc.dto';
import { UnpackGoalInputZipDto } from './dto/unpack-goal-input-zip.dto';
import { goalInputDirRelativePath } from './goal-doc-paths';
import {
  GOAL_UNPACK_MAX_DEPTH,
  GOAL_UNPACK_MAX_FILES,
  assertSafeZipEntry,
  assertUnpackedPathDepth,
  docTypeForUnpackedFile,
  isProbablyTextBuffer,
  shouldSkipUnpackedRelativePath,
} from './goal-unpack-input';
import { GoalRepository } from './infrastructure/persistence/goal.repository';

@Injectable()
export class GoalSourceDocsService {
  private readonly goalInputDirWalkMaxDepth = 12;

  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly projectsService: ProjectsService,
    private readonly projectDocsService: ProjectDocsService,
    private readonly gitService: GitService,
  ) {}

  async addSourceDoc(
    goal: Goal,
    dto: AddSourceDocDto,
    currentUser: JwtPayloadType,
  ) {
    const relativePath = this.projectDocsService.normalizeProjectDocPath(
      dto.projectDocPath,
    );
    await this.projectDocsService.readDoc(
      goal.projectId,
      relativePath,
      currentUser,
    );

    return this.goalRepository.insertSourceDoc({
      goalId: goal.id,
      projectDocPath: relativePath,
      docType: dto.docType,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async uploadSourceDoc(
    goal: Goal,
    dto: AddSourceDocDto,
    file: Buffer,
    currentUser: JwtPayloadType,
  ) {
    const relativePath = this.projectDocsService.normalizeProjectDocPath(
      dto.projectDocPath,
    );
    this.assertGoalInputPath(goal, relativePath, '资料');

    await this.persistGoalInputFilesToGit(
      goal,
      currentUser,
      `docs(goal): upload source doc for ${goal.id}`,
      async (worktreeRoot) => {
        const { absolutePath } =
          await this.projectDocsService.writeDocInRepositoryRoot(worktreeRoot, {
            path: relativePath,
            contentBase64: file.toString('base64'),
          });
        const { ignoredRelativePaths } =
          await this.gitService.filterIgnoredPathsInRepositoryRoot(
            worktreeRoot,
            [absolutePath],
          );
        if (ignoredRelativePaths.length) {
          await fs.rm(absolutePath, { force: true });
          throw new BadRequestException(
            `该资料路径被 Git ignore 规则忽略，不能作为需求资料提交：${ignoredRelativePaths.join(', ')}`,
          );
        }

        return {
          result: undefined,
          absolutePaths: [absolutePath],
        };
      },
    );

    return this.goalRepository.insertSourceDoc({
      goalId: goal.id,
      projectDocPath: relativePath,
      docType: dto.docType,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async uploadAndUnpackInputZip(
    goal: Goal,
    dto: AddSourceDocDto,
    file: Buffer,
    currentUser: JwtPayloadType,
  ): Promise<{ extractedFileCount: number; paths: string[] }> {
    const normalizedZipPath = this.projectDocsService.normalizeProjectDocPath(
      dto.projectDocPath,
    );
    const inputPrefix = `goals/${goal.id}/input/`;
    if (!normalizedZipPath.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('仅支持解压 .zip 文件');
    }
    this.assertGoalInputPath(goal, normalizedZipPath, 'zip');

    const sourceDocs = await this.goalRepository.listSourceDocs(goal.id);
    const maxSort = sourceDocs.reduce(
      (max, doc) => Math.max(max, doc.sortOrder),
      -1,
    );
    let sortOrder = maxSort + 1;

    const tempZipDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-goal-input-zip-'),
    );
    const tempZipPath = path.join(tempZipDir, path.basename(normalizedZipPath));

    try {
      await fs.writeFile(tempZipPath, file);
      const writtenDocs = await this.persistGoalInputFilesToGit(
        goal,
        currentUser,
        `docs(goal): unpack source docs for ${goal.id}`,
        async (worktreeRoot) => {
          const unpacked = await this.unpackZipIntoGoalInput(
            worktreeRoot,
            inputPrefix,
            tempZipPath,
          );

          return {
            result: unpacked.map(({ docType, relativePath }) => ({
              docType,
              relativePath,
            })),
            absolutePaths: unpacked.map((item) => item.absolutePath),
          };
        },
      );

      for (const doc of writtenDocs) {
        await this.goalRepository.insertSourceDoc({
          goalId: goal.id,
          projectDocPath: doc.relativePath,
          docType: doc.docType,
          sortOrder: sortOrder++,
        });
      }

      return {
        extractedFileCount: writtenDocs.length,
        paths: writtenDocs.map((doc) => doc.relativePath),
      };
    } finally {
      await fs.rm(tempZipDir, { recursive: true, force: true });
    }
  }

  async unpackInputZip(
    goal: Goal,
    dto: UnpackGoalInputZipDto,
    currentUser: JwtPayloadType,
  ): Promise<{ extractedFileCount: number; paths: string[] }> {
    const normalizedZipPath = this.projectDocsService.normalizeProjectDocPath(
      dto.projectDocPath,
    );
    const inputPrefix = `goals/${goal.id}/input/`;
    if (!normalizedZipPath.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('仅支持解压 .zip 文件');
    }
    this.assertGoalInputPath(goal, normalizedZipPath, 'zip');

    const sourceDocs = await this.goalRepository.listSourceDocs(goal.id);
    const maxSort = sourceDocs.reduce(
      (max, doc) => Math.max(max, doc.sortOrder),
      -1,
    );
    let sortOrder = maxSort + 1;

    const writtenDocs = await this.persistGoalInputFilesToGit(
      goal,
      currentUser,
      `docs(goal): unpack source docs for ${goal.id}`,
      async (worktreeRoot) => {
        const docsRoot = path.join(worktreeRoot, 'docs');
        const zipAbsPath =
          this.projectDocsService.resolveProjectDocAbsolutePath(
            docsRoot,
            normalizedZipPath,
          );
        const zipStat = await fs.stat(zipAbsPath).catch(() => null);
        if (!zipStat?.isFile()) {
          throw new NotFoundException('未找到 zip 文件');
        }
        const kept = await this.unpackZipIntoGoalInput(
          worktreeRoot,
          inputPrefix,
          zipAbsPath,
        );
        await fs.rm(zipAbsPath);

        return {
          result: kept.map(({ docType, relativePath }) => ({
            docType,
            relativePath,
          })),
          absolutePaths: [...kept.map((item) => item.absolutePath), zipAbsPath],
        };
      },
    );

    for (const doc of writtenDocs) {
      await this.goalRepository.insertSourceDoc({
        goalId: goal.id,
        projectDocPath: doc.relativePath,
        docType: doc.docType,
        sortOrder: sortOrder++,
      });
    }

    const zipRow = sourceDocs.find(
      (sourceDoc) => sourceDoc.projectDocPath === normalizedZipPath,
    );
    if (zipRow) {
      await this.goalRepository.removeSourceDoc(zipRow.id, goal.id);
    }

    return {
      extractedFileCount: writtenDocs.length,
      paths: writtenDocs.map((doc) => doc.relativePath),
    };
  }

  async goalInputDirHasAnyFile(
    projectId: string,
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<boolean> {
    const goal = await this.goalRepository.findById(goalId);
    if (!goal || goal.projectId !== projectId || !goal.gitBranch?.trim()) {
      return false;
    }

    return this.projectsService.runWithProjectRepositoryLock(
      projectId,
      currentUser,
      { syncRemote: true },
      async ({ repositoryRoot }) =>
        this.gitService.runInTemporaryBranchWorktree(
          repositoryRoot,
          goal.gitBranch!.trim(),
          async (worktreeRoot) =>
            this.goalInputDirHasAnyFileInRepositoryRoot(worktreeRoot, goalId),
        ),
    );
  }

  private async goalInputDirHasAnyFileInRepositoryRoot(
    repositoryRoot: string,
    goalId: string,
  ): Promise<boolean> {
    const inputAbs = path.join(
      repositoryRoot,
      'docs',
      goalInputDirRelativePath(goalId),
    );
    const stat = await fs.stat(inputAbs).catch(() => null);
    if (!stat?.isDirectory()) {
      return false;
    }

    return this.dirHasAnyFileUnder(inputAbs, 0);
  }

  private async unpackZipIntoGoalInput(
    worktreeRoot: string,
    inputPrefix: string,
    zipAbsPath: string,
  ): Promise<
    Array<{
      absolutePath: string;
      docType: ReturnType<typeof docTypeForUnpackedFile>;
      relativePath: string;
    }>
  > {
    const docsRoot = path.join(worktreeRoot, 'docs');
    const extractDirName = `${randomUUID()}-unpacked`;
    const extractRelative = `${inputPrefix}${extractDirName}`;
    const extractAbsPath =
      this.projectDocsService.resolveProjectDocAbsolutePath(
        docsRoot,
        extractRelative,
      );

    await fs.mkdir(extractAbsPath, { recursive: true });

    try {
      await extractZip(zipAbsPath, {
        dir: extractAbsPath,
        onEntry: (entry) => {
          assertSafeZipEntry(extractAbsPath, entry);
        },
      });
    } catch (error) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw error;
    }

    const collected = await this.collectFilesUnderExtractDir(extractAbsPath);
    if (collected.length > GOAL_UNPACK_MAX_FILES) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw new BadRequestException(
        `解压文件过多（超过 ${GOAL_UNPACK_MAX_FILES} 个）`,
      );
    }

    const written: Array<{
      absolutePath: string;
      docType: ReturnType<typeof docTypeForUnpackedFile>;
      relativePath: string;
    }> = [];
    for (const absolutePath of collected) {
      assertUnpackedPathDepth(extractAbsPath, absolutePath);
      const relativePath = path
        .relative(docsRoot, absolutePath)
        .split(path.sep)
        .join('/');
      if (shouldSkipUnpackedRelativePath(relativePath)) {
        continue;
      }

      const buffer = await fs.readFile(absolutePath);
      const payload = isProbablyTextBuffer(buffer)
        ? { path: relativePath, content: buffer.toString('utf-8') }
        : { path: relativePath, contentBase64: buffer.toString('base64') };
      const { absolutePath: writtenAbsolutePath } =
        await this.projectDocsService.writeDocInRepositoryRoot(
          worktreeRoot,
          payload,
        );
      written.push({
        absolutePath: writtenAbsolutePath,
        docType: docTypeForUnpackedFile(relativePath),
        relativePath,
      });
    }

    if (!written.length) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw new BadRequestException(
        '压缩包解压后没有可登记的有效文件（空包、仅目录、或仅有系统元数据如 __MACOSX）。请更换压缩包后重试。',
      );
    }

    const { keptAbsolutePaths, ignoredRelativePaths } =
      await this.gitService.filterIgnoredPathsInRepositoryRoot(
        worktreeRoot,
        written.map((item) => item.absolutePath),
      );
    const keptAbsolutePathSet = new Set(
      keptAbsolutePaths.map((item) => path.resolve(item)),
    );
    const kept = written.filter((item) =>
      keptAbsolutePathSet.has(path.resolve(item.absolutePath)),
    );
    if (!kept.length) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw new BadRequestException(
        `压缩包解压后没有可登记的有效文件（可能全部是缓存/构建产物，或被 .gitignore 忽略）。被忽略文件：${ignoredRelativePaths.join(', ') || '无'}。`,
      );
    }

    return kept;
  }

  private assertGoalInputPath(
    goal: Goal,
    relativePath: string,
    label: string,
  ): void {
    const inputPrefix = `${goalInputDirRelativePath(goal.id)}/`;
    if (!relativePath.startsWith(inputPrefix)) {
      throw new BadRequestException(`${label}须位于该需求的 input 目录下`);
    }
  }

  private async persistGoalInputFilesToGit<T>(
    goal: Goal,
    currentUser: JwtPayloadType,
    commitMessage: string,
    operation: (
      worktreeRoot: string,
    ) => Promise<{ result: T; absolutePaths: string[] }>,
  ): Promise<T> {
    const branch = goal.gitBranch?.trim();
    if (!branch) {
      throw new BadRequestException('需求未配置 Git 分支，无法保存资料');
    }

    return this.projectsService.runWithProjectRepositoryLock(
      goal.projectId,
      currentUser,
      { syncRemote: true },
      async ({ repositoryRoot }) =>
        this.gitService.runInTemporaryBranchWorktree(
          repositoryRoot,
          branch,
          async (worktreeRoot) => {
            await this.gitService.cleanupForeignUntrackedGoalDirs(
              worktreeRoot,
              goal.id,
            );
            const { result, absolutePaths } = await operation(worktreeRoot);
            const committed =
              await this.gitService.commitPathsInRepositoryRootIfDirty(
                worktreeRoot,
                absolutePaths,
                commitMessage,
                {
                  name: currentUser.username || 'ainative-user',
                  email: `${currentUser.username || currentUser.sub}@ainative.local`,
                },
              );
            if (!committed) {
              const status =
                await this.gitService.readStatusForPathsInRepositoryRoot(
                  worktreeRoot,
                  absolutePaths,
                );
              if (status) {
                throw new BadRequestException(
                  `资料已写入但未能生成提交，请清理工作区后重试: ${status}`,
                );
              }
            }
            await this.gitService.pushRepositoryHeadToBranch(
              worktreeRoot,
              branch,
            );
            return result;
          },
        ),
    );
  }

  private async dirHasAnyFileUnder(
    dirAbs: string,
    depth: number,
  ): Promise<boolean> {
    if (depth > this.goalInputDirWalkMaxDepth) {
      return false;
    }

    try {
      const entries = await fs.readdir(dirAbs, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = path.join(dirAbs, entry.name);
        if (entry.isDirectory()) {
          if (await this.dirHasAnyFileUnder(absolutePath, depth + 1)) {
            return true;
          }
        } else if (entry.isFile()) {
          return true;
        }
      }
    } catch {
      return false;
    }

    return false;
  }

  private async collectFilesUnderExtractDir(dir: string): Promise<string[]> {
    const out: string[] = [];

    const walk = async (dirPath: string, depth: number): Promise<void> => {
      if (depth > GOAL_UNPACK_MAX_DEPTH + 1) {
        throw new BadRequestException(
          `解压目录过深（超过 ${GOAL_UNPACK_MAX_DEPTH} 层）`,
        );
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath, depth + 1);
        } else if (entry.isFile()) {
          out.push(absolutePath);
        }
      }
    };

    await walk(dir, 0);
    return out;
  }
}
