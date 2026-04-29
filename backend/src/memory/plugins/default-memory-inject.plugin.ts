import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { ProjectRepository } from '../../projects/infrastructure/persistence/project.repository';
import { ProjectRepositoryWorkspaceService } from '../../projects/project-repository-workspace.service';
import { ProjectDocsService } from '../../projects/project-docs.service';
import {
  parseMemoryRoutingYaml,
  pathMatchesGlobs,
} from '../memory-routing.util';
import {
  buildInjectQuery,
  scoreSectionsForQuery,
  splitMarkdownByHeadings,
} from '../memory-text.util';
import type { HostCapabilities } from '../memory.types';
import type { MemoryInjectContext } from '../memory.types';
import type { MemoryInjectPlugin } from '../memory.types';
import { DEFAULT_MEMORY_PLUGIN_ID } from '../memory.types';

const DEFAULT_README_HEAD = 1200;

@Injectable()
export class DefaultMemoryInjectPlugin implements MemoryInjectPlugin {
  readonly id = DEFAULT_MEMORY_PLUGIN_ID;
  private readonly logger = new Logger(DefaultMemoryInjectPlugin.name);
  private routingCache = new Map<
    string,
    { mtimeMs: number; parsed: ReturnType<typeof parseMemoryRoutingYaml> }
  >();

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
    private readonly projectDocsService: ProjectDocsService,
  ) {}

  async build(
    ctx: MemoryInjectContext,
    caps: HostCapabilities,
  ): Promise<{ text: string; debug?: Record<string, unknown> }> {
    const cfg = caps.config;
    const project = await this.projectRepository.findById(ctx.projectId);
    if (!project) {
      return { text: '' };
    }

    const repoRoot =
      await this.projectRepositoryWorkspaceService.ensureProjectRepository(
        project,
        { syncRemote: false },
      );
    const memoryDir = path.join(repoRoot, 'docs', 'memory');
    const memStat = await fs.stat(memoryDir).catch(() => null);
    if (!memStat?.isDirectory()) {
      return { text: '' };
    }

    const routing = await this.loadRouting(memoryDir);
    const query = buildInjectQuery(
      [
        ctx.taskTitle,
        ctx.nodeName,
        ctx.userIntentSummary,
        ctx.taskPromptExcerpt,
      ],
      cfg.queryMaxChars,
    );

    const mdFiles = await this.listMemoryMarkdownFiles(memoryDir);
    const l0 = await this.readL0(memoryDir);

    const l1Paths = this.resolveL1Paths({
      routing,
      mdFiles,
      nodeTemplateId: ctx.nodeTemplateId ?? null,
    });

    const sections: Array<{ path: string; heading: string; body: string }> = [];
    for (const rel of [...l1Paths, ...mdFiles]) {
      const full = path.join(repoRoot, 'docs', ...rel.split('/'));
      const raw = await fs.readFile(full, 'utf-8').catch(() => '');
      if (!raw.trim()) {
        continue;
      }
      const parts = splitMarkdownByHeadings(raw);
      for (const p of parts) {
        sections.push({
          path: rel,
          heading: p.heading,
          body: p.body,
        });
      }
    }

    const pool = sections.length
      ? sections
      : (
          await Promise.all(
            mdFiles.map(async (rel) => {
              const full = path.join(repoRoot, 'docs', ...rel.split('/'));
              const body = await fs.readFile(full, 'utf-8').catch(() => '');
              return {
                path: rel,
                heading: '## _root',
                body,
              };
            }),
          )
        ).filter((s) => s.body.trim());

    const scored = scoreSectionsForQuery({ query, sections: pool })
      .filter((s) => s.score > 0)
      .slice(0, cfg.l2TopKSections);

    const l1Block = l1Paths
      .map((p) => {
        const found = pool.find((x) => x.path === p);
        return found
          ? `#### ${found.path}\n${found.heading}\n${found.body.slice(0, cfg.l2SectionMaxChars)}`
          : `- ${p}`;
      })
      .join('\n\n');

    const l2Block = scored
      .map(
        (s) =>
          `#### ${s.path} / ${s.heading}\n${s.body.slice(0, cfg.l2SectionMaxChars)}`,
      )
      .join('\n\n');

    let inject = [
      '<!-- memory_inject: begin -->',
      '## 项目记忆与约束（自动注入）',
      l0 ? `### 基线\n${l0}` : '',
      '### 与本节点相关的必读条目',
      l1Block || '（无）',
      '### 检索到的相关条目',
      l2Block || '（无）',
      '<!-- memory_inject: end -->',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (inject.length > cfg.injectMaxChars) {
      const over = inject.length - cfg.injectMaxChars;
      inject = `${inject.slice(0, Math.max(0, inject.length - over - 200))}…\n<!-- memory_inject: end -->`;
    }

    this.logger.debug(
      `memory_inject project=${ctx.projectId} node=${ctx.nodeId} len=${inject.length}`,
    );
    return { text: inject, debug: { queryLen: query.length } };
  }

  private async readL0(memoryDir: string): Promise<string> {
    const p = path.join(memoryDir, 'README.md');
    const s = await fs.readFile(p, 'utf-8').catch(() => '');
    if (!s.trim()) {
      return '（无 README 内容）';
    }
    return s.slice(0, DEFAULT_README_HEAD);
  }

  private async loadRouting(
    memoryDir: string,
  ): Promise<ReturnType<typeof parseMemoryRoutingYaml>> {
    const routingPath = path.join(memoryDir, '_routing.yaml');
    const st = await fs.stat(routingPath).catch(() => null);
    if (!st) {
      return { includeGlobs: [], slots: {} };
    }
    const c = this.routingCache.get(routingPath);
    if (c && c.mtimeMs === st.mtimeMs) {
      return c.parsed;
    }
    const raw = await fs.readFile(routingPath, 'utf-8');
    const parsed = parseMemoryRoutingYaml(raw);
    this.routingCache.set(routingPath, { mtimeMs: st.mtimeMs, parsed });
    return parsed;
  }

  private async listMemorySubFiles(memoryDir: string): Promise<string[]> {
    const entries = await fs.readdir(memoryDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => `memory/${e.name}`);
  }

  private async listMemoryMarkdownFiles(memoryDir: string): Promise<string[]> {
    const out = await this.listMemorySubFiles(memoryDir);
    if (out.length) {
      return out;
    }
    return [];
  }

  private resolveL1Paths(args: {
    routing: ReturnType<typeof parseMemoryRoutingYaml>;
    mdFiles: string[];
    nodeTemplateId: string | null;
  }): string[] {
    const fromSlots =
      (args.nodeTemplateId && args.routing.slots[args.nodeTemplateId]) || [];
    if (fromSlots.length) {
      return fromSlots.map((p) =>
        this.projectDocsService.normalizeProjectDocPath(p),
      );
    }
    if (args.routing.includeGlobs.length) {
      return args.mdFiles.filter((f) =>
        pathMatchesGlobs(f, args.routing.includeGlobs),
      );
    }
    return [];
  }
}
