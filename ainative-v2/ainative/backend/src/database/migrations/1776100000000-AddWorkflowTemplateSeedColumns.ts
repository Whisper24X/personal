import { MigrationInterface, QueryRunner } from 'typeorm';
import { WorkflowNodeType } from '../../workflow-templates/dto/workflow-node-type.enum';
import { WorkflowTemplateMode } from '../../workflow-templates/dto/workflow-template-mode.enum';
import { WorkflowTemplateScope } from '../../workflow-templates/dto/workflow-template-scope.enum';
import type { WorkflowTemplateNodeDto } from '../../workflow-templates/dto/workflow-template-node.dto';
import {
  ensureValidWorkflowTemplateNodes,
  normalizeWorkflowTemplateNodes,
} from '../../workflow-templates/workflow-template-nodes.util';

const MIGRATION_DEFAULT_GLOBAL_WORKFLOW_TEMPLATE: {
  name: string;
  description: string | null;
  nodes: WorkflowTemplateNodeDto[];
} = {
  name: '默认工作流',
  description: '请在业务线工作流管理中为各节点配置 Agent CLI。',
  nodes: [
    {
      nodeOrder: 1,
      name: '需求澄清',
      type: WorkflowNodeType.agent,
      requiresApproval: true,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`brainstorm\` 技能，根据以下需求生成需求澄清文档：
{{taskPrompt}}

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/brainstorm.md\`。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 2,
      name: 'MRD文档',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`mrd\` 技能，优先基于 \`docs/{{gitBranch}}/brainstorm.md\`，并结合以下需求生成 MRD：
{{taskPrompt}}

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/MRD.md\`。

如果信息不足，只允许做最小必要假设；所有假设必须单独列在“假设与待确认项”中，不得混入正式结论。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 3,
      name: '产品需求文档',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`prd\` 技能，基于 \`docs/{{gitBranch}}/brainstorm.md\`、\`docs/{{gitBranch}}/MRD.md\` 和以下需求生成 PRD：
{{taskPrompt}}

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/PRD.md\`。

如果 MRD 不存在或信息不足，只允许做最小必要假设并结合需求补全；所有假设必须单独列在“假设与待确认项”中，不得混入正式结论。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 4,
      name: '原型图',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`prototype\` 技能，基于 \`docs/{{gitBranch}}/PRD.md\` 生成高保真原型。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/prototype/index.html\`。

原型需覆盖核心页面、关键交互、状态变化、异常态和空态，并尽量贴近真实产品效果。
如果 PRD 信息不足，只允许做最小必要假设；所有假设必须单独列在“假设与待确认项”中，不得混入正式结论。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 5,
      name: '测试用例',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`test\` 技能，基于 \`docs/{{gitBranch}}/PRD.md\` 生成测试文档；如果存在 \`docs/{{gitBranch}}/prototype/index.html\` 也一并参考。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/TEST.md\`。

测试文档需覆盖测试范围、测试策略、前置条件、测试数据、功能测试、异常测试、边界测试和回归建议。
如果需求或原型信息不足，只允许做最小必要假设；所有假设必须单独列在“假设与待确认项”中，不得混入正式结论。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 6,
      name: '系统架构文档',
      type: WorkflowNodeType.agent,
      requiresApproval: true,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`design\` 技能，基于 \`docs/{{gitBranch}}/PRD.md\`、\`docs/{{gitBranch}}/TEST.md\` 和当前仓库实现生成系统设计文档。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 默认分支：{{projectDefaultBranch}}
- 当前分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/DESIGN.md\`。

设计文档需覆盖架构概览、模块拆分、关键数据结构、接口/领域对象、状态流转、异常处理、风险与取舍。
如果需求或现有实现信息不足，只允许做最小必要假设；所有假设必须单独列在“假设与待确认项”中，不得混入正式结论。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 7,
      name: '任务拆分',
      type: WorkflowNodeType.agent,
      requiresApproval: true,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`project-manager\` 技能进行任务拆解。

文档路径（必须使用以下路径，与上游 MRD/PRD/DESIGN 一致）：
- PRD：\`docs/{{gitBranch}}/PRD.md\`
- DESIGN：\`docs/{{gitBranch}}/DESIGN.md\`
- 审查报告输出：\`docs/{{gitBranch}}/openspecValidatorReport.md\`

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 8,
      name: '代码生成',
      type: WorkflowNodeType.agent,
      requiresApproval: true,
      requiresArtifact: false,
      input: {
        prompt: `按顺序使用 \`code-task-apply\`、\`code-evaluate-completion\`、\`code-task-check\` 技能，基于以下输入完成代码实现：

输入文档：
- 原始需求：{{taskPrompt}}
- 需求澄清：\`docs/{{gitBranch}}/brainstorm.md\`
- 需求文档：\`docs/{{gitBranch}}/PRD.md\`
- 测试文档：\`docs/{{gitBranch}}/TEST.md\`
- 设计文档：\`docs/{{gitBranch}}/DESIGN.md\`

输出文档（必须使用以下路径）：
- applyResult：\`docs/{{gitBranch}}/applyResult.md\`
- evaluateResult：\`docs/{{gitBranch}}/evaluateResult.md\`
- taskResult：\`docs/{{gitBranch}}/taskResult.md\`

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 默认分支：{{projectDefaultBranch}}
- 当前分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

请直接修改仓库中的实际代码并完成必要校验。

优先复用现有实现，不要做无关重构；如有必要，请补充相关测试。
如果需求、设计或代码上下文信息不足，只允许做最小必要假设；所有假设、风险和待确认项必须单独列出，不得当作已确认事实写入实现说明。

**最终输出**：执行完三个技能后，将 \`taskResult.md\` 的内容（状态 + 原因两行）作为本节点的最终输出展示给用户。`,
        loopEnabled: true,
        maxLoops: 3,
        earlyExitMarkerEnabled: true,
        earlyExitMarkerFileName: 'taskResult',
      },
    },
    {
      nodeOrder: 9,
      name: '代码改进',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `按顺序使用 \`improve-review\`、\`improve-analyze\`、\`improve-execute\`、\`improve-verify\` 技能，对当前实现进行改进。

参考输入：
- 原始需求：{{taskPrompt}}
- 需求澄清：\`docs/{{gitBranch}}/brainstorm.md\`
- 需求文档：\`docs/{{gitBranch}}/PRD.md\`
- 测试文档：\`docs/{{gitBranch}}/TEST.md\`
- 设计文档：\`docs/{{gitBranch}}/DESIGN.md\`

输出文档（必须使用以下路径；若与技能仓库内旧表述冲突，以本节点为准）：
- improve-review：\`docs/{{gitBranch}}/improveReviewResult.md\`（**Markdown 结构化文档**：\`# 标题\` + \`## Summary\` + \`## Issues\` + 分条 \`### Issue N\`）
- improve-analyze：\`docs/{{gitBranch}}/improveAnalyzeResult.md\`（**Markdown 结构化文档**，同上格式；排序后的问题清单）
- improve-execute：\`docs/{{gitBranch}}/improveExecuteResult.md\`（两行纯文本：状态 + 原因）；在 \`improveAnalyzeResult.md\` 对应 \`### Issue N\` 小节内回写 \`**status**\`、\`**resolution_note**\` 等字段
- improve-verify：\`docs/{{gitBranch}}/improveVerifyResult.md\`（三行纯文本：状态 + 原因 + 详情）；完成时先将 \`improveAnalyzeResult.md\` 全文追加至 \`docs/{{gitBranch}}/improveHistory.md\` 再删除前者

**注意**：\`improveReviewResult.md\` 与 \`improveAnalyzeResult.md\` 使用 **Markdown 结构化格式**，**禁止**输出裸 JSON。详见各技能 SKILL.md 中的格式说明与示例。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 当前分支：{{gitBranch}}
- 基线分支：{{gitBaseBranch}}
- 项目默认分支：{{projectDefaultBranch}}
- 工作目录：{{gitWorktreePath}}

变更范围：improve-review 及后续技能须覆盖「相对基线（gitBaseBranch）已提交到当前分支的改动（BASE...HEAD）」与「当前工作区未提交增量」两者的并集，不得仅依赖 git status。

请聚焦修复正确性、边界条件、可维护性、类型安全和测试覆盖问题，并完成必要校验。
如果改进依据不足，只允许做最小必要假设；所有假设、风险和待确认项必须单独列出，不得当作已确认事实写入结论。

**最终输出**：本节点循环结束时，将 \`improveVerifyResult.md\` 的第 1 行（状态）与第 2 行（原因摘要）作为本节点的最终输出展示给用户。`,
        loopEnabled: true,
        maxLoops: 2,
        earlyExitMarkerEnabled: true,
        earlyExitMarkerFileName: 'improveVerifyResult',
      },
    },
    {
      nodeOrder: 10,
      name: '变更确认',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`code-doc\` 技能，扫描「相对基线（gitBaseBranch）已提交到当前分支的改动（BASE...HEAD）」与「当前工作区未提交改动」的并集，按技能内模板生成接口变更清单与功能变更测试清单。

输出文档（必须使用以下路径）：
- \`docs/{{gitBranch}}/apiChanges.md\`
- \`docs/{{gitBranch}}/moduleChanges.md\`

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 当前分支：{{gitBranch}}
- 基线分支：{{gitBaseBranch}}
- 项目默认分支：{{projectDefaultBranch}}
- 工作目录：{{gitWorktreePath}}

若 BASE...HEAD 与工作区均无改动，在产出中如实说明；不要编造未发生的接口或功能变更。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 11,
      name: '测试用例改善',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`path-guide\` 技能，在部署完成后将测试用例升级为「自动化就绪」：读取 PRD、扫描管理后台前端源码，并**原地更新** \`docs/{{gitBranch}}/TEST.md\`（不另生成独立用例文件）。

若当前仓库存在 \`.cursor/skills/path-guide\`，请严格按该技能的分步流程（Step 1–7）与禁止事项执行。

输入与扫描范围：
- PRD：\`docs/{{gitBranch}}/PRD.md\`
- 测试文档（读入并写回）：\`docs/{{gitBranch}}/TEST.md\`
- 前端源码：扫描 \`{{gitWorktreePath}}/ainative-shadow\`（管理后台根目录，工作流约定该路径存在）。

输出：
- 仅更新 \`docs/{{gitBranch}}/TEST.md\`：补充/优化 Given（Playwright 可执行前提）、When（侧栏导航路径与等待点）、Then（页面可观测断言），必要时补充元素选择块与自动化可行性标注。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

如果 PRD、源码或测试文档信息不足，只允许做最小必要假设；所有假设必须单独列在「假设与待确认项」中，不得混入正式用例结论。`,
        loopEnabled: false,
        maxLoops: 1,
      },
    },
    {
      nodeOrder: 12,
      name: '自动测试',
      type: WorkflowNodeType.agent,
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: `使用 \`playwright-skill\` 技能，基于 \`docs/{{gitBranch}}/TEST.md\` 生成 Playwright 自动化脚本并逐条执行。严格遵循技能 SKILL.md 中的全量对账、覆盖率表、状态取值等契约。

**固定顺序（禁止颠倒）：**
① **地址预检**：读取 \`$SKILL_DIR/references/LOGIN_ACCOUNT.md\` 中的「项目地址」，用 \`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 <项目地址>\` 验证可达。若不可达，**停止**并向用户确认正确地址、修正后再继续。
② **生成脚本**：按 SKILL.md 流程，为 TEST.md 中每个「类型 | 管理后台」用例生成 \`docs/{{gitBranch}}/artifacts/playwright/by-id/playwright-test-<TC-ID>.js\`，然后用 \`validate-tc-by-id-dir.js ... --type 管理后台\` 校验，再更新 \`docs/{{gitBranch}}/AUTOMATED_TEST.md\`。
③ **执行前再检**：再次 \`curl\` 验证地址可达，不可达则停止。
④ **逐条执行**：\`run-by-id-sequential.js docs/{{gitBranch}}/TEST.md docs/{{gitBranch}}/artifacts/playwright/by-id --type 管理后台 --headed --continue-on-fail\`。**禁止**在未生成脚本前执行。

**脚本自包含（硬性）：**
- 每个 \`playwright-test-<TC-ID>.js\` 必须**完全自包含**：自行 \`applyLoginEnvIfUnset()\`、启动浏览器、登录、导航、执行测试、关闭浏览器。**禁止**依赖 \`shared-harness.js\` 等外部公共模块（\`references/login-env.js\` 除外）。
- 原因：\`run.js\` 将脚本写到 skill 目录下的临时文件再 \`require\`，\`__dirname\` 指向 skill 目录而非 by-id 目录，对 by-id 下其他文件的相对路径会失败。多个脚本有相同逻辑时直接重复。

**Element Plus 侧栏菜单定位：**
- 一级菜单：\`page.locator('.el-sub-menu__title').filter({ hasText: '菜单文本' })\`（勿用 \`getByRole('menuitem')\`）。
- 子菜单项：\`page.locator('.el-menu-item').filter({ hasText: '菜单文本' })\`。
- 菜单不存在时**优雅降级**：15s 内未出现则列出可见菜单项，输出 \`[skipped]\` 并 exit 0，不超时崩溃。

输入：
- 测试文档：\`docs/{{gitBranch}}/TEST.md\`

输出目录 \`docs/{{gitBranch}}/\`：
- \`AUTOMATED_TEST.md\`（覆盖率总表 + 执行命令）
- \`artifacts/playwright/by-id/\`（脚本留档，仅管理后台）

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

凭据从环境变量或 \`references/LOGIN_ACCOUNT.md\` 读取，**禁止**硬编码账号密码与固定域名。`,
        loopEnabled: true,
        maxLoops: 4,
      },
    },
  ],
};

export class AddWorkflowTemplateSeedColumns1776100000000
  implements MigrationInterface
{
  name = 'AddWorkflowTemplateSeedColumns1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD "seedOnBusinessLineCreate" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "workflow_templates"."seedOnBusinessLineCreate" IS '新建业务线时是否从该 global 母版复制到业务线'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD "businessLineSeedOrder" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "workflow_templates"."businessLineSeedOrder" IS '多条母版参与种子时的排序（升序；相同则按创建时间）'`,
    );

    const definition = MIGRATION_DEFAULT_GLOBAL_WORKFLOW_TEMPLATE;

    ensureValidWorkflowTemplateNodes(definition.nodes);
    const nodesJson = normalizeWorkflowTemplateNodes(definition.nodes);
    const mode = WorkflowTemplateMode.workflow;
    const scope = WorkflowTemplateScope.global;

    await queryRunner.query(
      `
      INSERT INTO "workflow_templates" (
        "name",
        "description",
        "mode",
        "scope",
        "businessLineId",
        "projectId",
        "isActive",
        "nodesJson",
        "seedOnBusinessLineCreate",
        "businessLineSeedOrder",
        "createdBy"
      )
      SELECT $1::varchar, $2, $3::"public"."workflow_template_mode_enum", $4::"public"."workflow_template_scope_enum", NULL, NULL, true, $5::jsonb, true, 0, NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM "workflow_templates" wt
        WHERE wt."deletedAt" IS NULL AND wt."scope" = 'global' AND wt."name" = $1::varchar
      )
      `,
      [
        definition.name,
        definition.description ?? null,
        mode,
        scope,
        JSON.stringify(nodesJson),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP COLUMN "businessLineSeedOrder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP COLUMN "seedOnBusinessLineCreate"`,
    );
  }
}
