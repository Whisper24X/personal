import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import extractZip from 'extract-zip';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
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
    if (!normalizedZipPath.startsWith(inputPrefix)) {
      throw new BadRequestException('zip 须位于该需求的 input 目录下');
    }

    const { repositoryRoot } =
      await this.projectsService.ensureProjectRepositoryReady(
        goal.projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const zipAbsPath = path.join(docsRoot, normalizedZipPath);
    const zipStat = await fs.stat(zipAbsPath).catch(() => null);
    if (!zipStat?.isFile()) {
      throw new NotFoundException('未找到 zip 文件');
    }

    const extractDirName = `${randomUUID()}-unpacked`;
    const extractRelative = `${inputPrefix}${extractDirName}`;
    const extractAbsPath = path.join(docsRoot, extractRelative);

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

    const sourceDocs = await this.goalRepository.listSourceDocs(goal.id);
    const maxSort = sourceDocs.reduce(
      (max, doc) => Math.max(max, doc.sortOrder),
      -1,
    );
    let sortOrder = maxSort + 1;

    const collected = await this.collectFilesUnderExtractDir(extractAbsPath);
    if (collected.length > GOAL_UNPACK_MAX_FILES) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw new BadRequestException(
        `解压文件过多（超过 ${GOAL_UNPACK_MAX_FILES} 个）`,
      );
    }

    const writtenPaths: string[] = [];
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
      const docType = docTypeForUnpackedFile(relativePath);
      const payload = isProbablyTextBuffer(buffer)
        ? { path: relativePath, content: buffer.toString('utf-8') }
        : { path: relativePath, contentBase64: buffer.toString('base64') };

      try {
        await this.projectDocsService.createDoc(
          goal.projectId,
          payload,
          currentUser,
        );
      } catch (error) {
        if (error instanceof ConflictException) {
          await this.projectDocsService.updateDoc(
            goal.projectId,
            payload,
            currentUser,
          );
        } else {
          throw error;
        }
      }

      await this.goalRepository.insertSourceDoc({
        goalId: goal.id,
        projectDocPath: relativePath,
        docType,
        sortOrder: sortOrder++,
      });
      writtenPaths.push(relativePath);
    }

    if (!writtenPaths.length) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw new BadRequestException(
        '压缩包解压后没有可登记的有效文件（空包、仅目录、或仅有系统元数据如 __MACOSX）。请更换压缩包后重试；原 zip 已保留。',
      );
    }

    await this.projectDocsService.removeDoc(
      goal.projectId,
      normalizedZipPath,
      currentUser,
    );
    const zipRow = sourceDocs.find(
      (sourceDoc) => sourceDoc.projectDocPath === normalizedZipPath,
    );
    if (zipRow) {
      await this.goalRepository.removeSourceDoc(zipRow.id, goal.id);
    }

    return {
      extractedFileCount: writtenPaths.length,
      paths: writtenPaths,
    };
  }

  async goalInputDirHasAnyFile(
    projectId: string,
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<boolean> {
    const { repositoryRoot } =
      await this.projectsService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
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
