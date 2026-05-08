import { MigrationInterface, QueryRunner } from 'typeorm';
import { WorkflowNodeType } from '../../workflow-templates/dto/workflow-node-type.enum';
import { WorkflowTemplateMode } from '../../workflow-templates/dto/workflow-template-mode.enum';
import { WorkflowTemplateScope } from '../../workflow-templates/dto/workflow-template-scope.enum';
import type { WorkflowTemplateNodeDto } from '../../workflow-templates/dto/workflow-template-node.dto';
import {
  ensureValidWorkflowTemplateNodes,
  normalizeWorkflowTemplateNodes,
} from '../../workflow-templates/workflow-template-nodes.util';

const TEMPLATE_NAME = 'V2.1 增强工作流';
const TEMPLATE_DESCRIPTION =
  '带上下文继承、产物自检、渐进自主协议的增强版默认工作流（V2.1）';

const V21_WORKFLOW_NODES: WorkflowTemplateNodeDto[] = [
  {
    nodeOrder: 1,
    name: 'Brainstorm',
    type: WorkflowNodeType.agent,
    requiresApproval: true,
    requiresArtifact: true,
    input: {
      prompt: `使用 \`brainstorm\` 技能，根据以下需求生成需求澄清文档：
{{taskPrompt}}

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/brainstorm.md\`。

**提问要求（Tier 1）**：本节点必须向用户提问以澄清需求。每个问题必须附带 2-3 个选项和 AI 推荐，格式如下：
> **[问题标题]**
> [问题描述，1-2 句]
>
> - A. [选项 A] -- [简要理由] -- **推荐**
> - B. [选项 B] -- [简要理由]
> - C. [选项 C] -- [简要理由]
>
> 若您不做选择，我将采用推荐选项继续。

每次最多 3 个问题，若用户未回复则按推荐选项继续。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/brainstorm.md\` 存在且内容有效（非空、包含至少 1 个二级标题）。不通过则基于已有信息重新生成。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。`,
    },
  },
  {
    nodeOrder: 2,
    name: 'WriteMRD',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
    requiresArtifact: true,
    input: {
      prompt: `使用 \`mrd\` 技能，优先基于 \`docs/{{gitBranch}}/brainstorm.md\`，并结合以下需求生成 MRD：
{{taskPrompt}}

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/MRD.md\`。

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。如果上游依赖状态报告显示 brainstorm.md 为 missing 或 thin，优先从 context-snapshot 和 {{taskPrompt}} 中推导补全，做最小必要假设并在"假设与待确认项"中标注来源。

**提问要求（Tier 1）**：允许向用户提问以补充需求细节。每个问题必须附带选项和 AI 推荐。每次最多 3 个问题，若用户未回复则按推荐选项继续。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/MRD.md\` 存在且内容有效（非空、包含至少 1 个二级标题）。不通过则基于已有信息重新生成。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。`,
    },
  },
  {
    nodeOrder: 3,
    name: 'WritePRD',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
    requiresArtifact: true,
    input: {
      prompt: `使用 \`prd\` 技能，基于 \`docs/{{gitBranch}}/brainstorm.md\`、\`docs/{{gitBranch}}/MRD.md\` 和以下需求生成 PRD：
{{taskPrompt}}

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/PRD.md\`。

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对上游依赖状态报告中 missing 或 thin 的文件，从 context-snapshot 和 {{taskPrompt}} 中推导补全，做最小必要假设并在"假设与待确认项"中标注来源。

**提问要求（Tier 2）**：仅在遇到阻断性未知（如技术路线二选一、需求范围严重模糊）时允许提问，附带选项和 AI 推荐。其他不确定性自行决策，记录在"AI 决策记录"小节中。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/PRD.md\` 存在且内容有效（非空、包含至少 2 个二级标题）。不通过则基于已有信息重新生成。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。`,
    },
  },
  {
    nodeOrder: 4,
    name: 'GeneratePrototype',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
    requiresArtifact: true,
    input: {
      prompt: `使用 \`prototype\` 技能，基于 \`docs/{{gitBranch}}/PRD.md\` 生成高保真原型。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/prototype/index.html\`。

原型需覆盖核心页面、关键交互、状态变化、异常态和空态，并尽量贴近真实产品效果。

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 和 {{taskPrompt}} 推导补全，做最小必要假设并标注来源。

**提问要求（Tier 3）**：禁止向用户提问。所有不确定性自行解决，假设记录在"假设与待确认项"中。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/prototype/index.html\` 存在且包含有效 HTML 结构。不通过则重新生成。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。`,
    },
  },
  {
    nodeOrder: 5,
    name: 'WriteTest',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
    requiresArtifact: true,
    input: {
      prompt: `使用 \`test\` 技能，基于 \`docs/{{gitBranch}}/PRD.md\` 生成测试文档；如果存在 \`docs/{{gitBranch}}/prototype/index.html\` 也一并参考。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

输出文件保存到 \`docs/{{gitBranch}}/TEST.md\`。

测试文档需覆盖测试范围、测试策略、前置条件、测试数据、功能测试、异常测试、边界测试和回归建议。

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 和 {{taskPrompt}} 推导补全，做最小必要假设并标注来源。

**提问要求（Tier 3）**：禁止向用户提问。所有不确定性自行解决，假设记录在"假设与待确认项"中。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/TEST.md\` 存在且内容有效（非空、包含至少 2 个二级标题）。不通过则重新生成。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。`,
    },
  },
  {
    nodeOrder: 6,
    name: 'WriteDesign',
    type: WorkflowNodeType.agent,
    requiresApproval: true,
    requiresArtifact: true,
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

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 和 {{taskPrompt}} 推导补全，做最小必要假设并标注来源。

**提问要求（Tier 2）**：仅在遇到阻断性未知（如技术架构选型、关键取舍）时允许提问，附带选项和 AI 推荐。其他不确定性自行决策，记录在"AI 决策记录"小节中。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/DESIGN.md\` 存在且内容有效（非空、包含至少 2 个二级标题）。不通过则重新生成。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。`,
    },
  },
  {
    nodeOrder: 7,
    name: 'ProjectManager',
    type: WorkflowNodeType.agent,
    requiresApproval: true,
    requiresArtifact: true,
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
- 工作目录：{{gitWorktreePath}}

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 和 {{taskPrompt}} 推导补全，做最小必要假设并标注来源。

**提问要求（Tier 2）**：仅在遇到阻断性未知（如任务拆分粒度、优先级冲突）时允许提问，附带选项和 AI 推荐。其他不确定性自行决策。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/openspecValidatorReport.md\` 存在且内容有效。不通过则重新生成。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。`,
    },
  },
  {
    nodeOrder: 8,
    name: 'WriteCode',
    type: WorkflowNodeType.agent,
    requiresApproval: true,
    requiresArtifact: true,
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

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 和 {{taskPrompt}} 推导补全，做最小必要假设并标注来源。

**提问要求（Tier 3）**：禁止向用户提问。所有假设、风险和待确认项必须单独列出，不得当作已确认事实写入实现说明。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/taskResult.md\` 存在且符合固定行格式（第 1 行状态、第 2 行原因，均非空）。不通过则补写。

**上下文写入**：完成后将关键决策摘要追加到 \`docs/{{gitBranch}}/context-snapshot.md\`。

**最终输出**：执行完三个技能后，将 \`taskResult.md\` 的内容（状态 + 原因两行）作为本节点的最终输出展示给用户。`,
      loopEnabled: true,
      maxLoops: 3,
      earlyExitMarkerFileName: 'taskResult',
    },
  },
  {
    nodeOrder: 9,
    name: 'ImproveCode',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
    requiresArtifact: true,
    input: {
      prompt: `按顺序使用 \`improve-review\`、\`improve-analyze\`、\`improve-execute\`、\`improve-verify\` 技能，对当前实现进行改进。

参考输入：
- 原始需求：{{taskPrompt}}
- 需求澄清：\`docs/{{gitBranch}}/brainstorm.md\`
- 需求文档：\`docs/{{gitBranch}}/PRD.md\`
- 测试文档：\`docs/{{gitBranch}}/TEST.md\`
- 设计文档：\`docs/{{gitBranch}}/DESIGN.md\`

输出文档（必须使用以下路径；若与技能仓库内旧表述冲突，以本节点为准）：
- improve-review：\`docs/{{gitBranch}}/improveReviewResult.md\`（Markdown 结构化文档）
- improve-analyze：\`docs/{{gitBranch}}/improveAnalyzeResult.md\`（Markdown 结构化文档）
- improve-execute：\`docs/{{gitBranch}}/improveExecuteResult.md\`（两行纯文本：状态 + 原因）
- improve-verify：\`docs/{{gitBranch}}/improveVerifyResult.md\`（三行纯文本：状态 + 原因 + 详情）

注意：\`improveReviewResult.md\` 与 \`improveAnalyzeResult.md\` 使用 Markdown 结构化格式，禁止输出裸 JSON。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 当前分支：{{gitBranch}}
- 基线分支：{{gitBaseBranch}}
- 项目默认分支：{{projectDefaultBranch}}
- 工作目录：{{gitWorktreePath}}

变更范围：improve-review 及后续技能须覆盖「相对基线（gitBaseBranch）已提交到当前分支的改动（BASE...HEAD）」与「当前工作区未提交增量」两者的并集，不得仅依赖 git status。

请聚焦修复正确性、边界条件、可维护性、类型安全和测试覆盖问题，并完成必要校验。

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 和 {{taskPrompt}} 推导补全。

**提问要求（Tier 3）**：禁止向用户提问。所有假设、风险和待确认项必须单独列出，不得当作已确认事实写入结论。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/improveVerifyResult.md\` 存在且符合固定行格式（第 1 行状态、第 2 行原因，均非空）。不通过则补写。

**最终输出**：本节点循环结束时，将 \`improveVerifyResult.md\` 的第 1 行（状态）与第 2 行（原因摘要）作为本节点的最终输出展示给用户。`,
      loopEnabled: true,
      maxLoops: 2,
      earlyExitMarkerFileName: 'improveVerifyResult',
    },
  },
  {
    nodeOrder: 10,
    name: 'DocumentChanges',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
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

若 BASE...HEAD 与工作区均无改动，在产出中如实说明；不要编造未发生的接口或功能变更。

**提问要求（Tier 3）**：禁止向用户提问。

**产物自检**：完成后确认 \`docs/{{gitBranch}}/apiChanges.md\` 和 \`docs/{{gitBranch}}/moduleChanges.md\` 存在且内容有效。`,
    },
  },
  {
    nodeOrder: 11,
    name: 'TESTPathGuide',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
    input: {
      prompt: `使用 \`path-guide\` 技能，在部署完成后将测试用例升级为「自动化就绪」：读取 PRD、扫描管理后台前端源码，并原地更新 \`docs/{{gitBranch}}/TEST.md\`（不另生成独立用例文件）。

若当前仓库存在 \`.cursor/skills/path-guide\`，请严格按该技能的分步流程（Step 1–7）与禁止事项执行。

输入与扫描范围：
- PRD：\`docs/{{gitBranch}}/PRD.md\`
- 测试文档（读入并写回）：\`docs/{{gitBranch}}/TEST.md\`
- 前端源码：扫描 \`{{gitWorktreePath}}/ainative-shadow\`（管理后台根目录，工作流约定该路径存在）。

输出：
- 仅更新 \`docs/{{gitBranch}}/TEST.md\`：补充/优化 Given、When、Then，必要时补充元素选择块与自动化可行性标注。

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 和 {{taskPrompt}} 推导补全。

**提问要求（Tier 3）**：禁止向用户提问。所有假设必须单独列在「假设与待确认项」中，不得混入正式用例结论。`,
    },
  },
  {
    nodeOrder: 12,
    name: 'TESTPlaywright',
    type: WorkflowNodeType.agent,
    requiresApproval: false,
    input: {
      prompt: `使用 \`playwright-skill\` 技能，基于 \`docs/{{gitBranch}}/TEST.md\` 生成 Playwright 自动化脚本并逐条执行。严格遵循技能 SKILL.md 中的全量对账、覆盖率表、状态取值等契约。

固定顺序（禁止颠倒）：
① 地址预检：读取 $SKILL_DIR/references/LOGIN_ACCOUNT.md 中的「项目地址」，用 curl 验证可达。若不可达，停止并向用户确认正确地址。
② 生成脚本：按 SKILL.md 流程，为 TEST.md 中每个「类型 | 管理后台」用例生成脚本，然后校验，再更新 AUTOMATED_TEST.md。
③ 执行前再检：再次 curl 验证地址可达，不可达则停止。
④ 逐条执行：run-by-id-sequential.js 执行。禁止在未生成脚本前执行。

脚本自包含（硬性）：每个脚本必须完全自包含，禁止依赖外部公共模块（login-env.js 除外）。

Element Plus 侧栏菜单定位：
- 一级菜单：page.locator('.el-sub-menu__title').filter({ hasText: '菜单文本' })
- 子菜单项：page.locator('.el-menu-item').filter({ hasText: '菜单文本' })
- 菜单不存在时优雅降级：15s 内未出现则列出可见菜单项，输出 [skipped] 并 exit 0。

输入：
- 测试文档：\`docs/{{gitBranch}}/TEST.md\`

输出目录 \`docs/{{gitBranch}}/\`：
- AUTOMATED_TEST.md（覆盖率总表 + 执行命令）
- artifacts/playwright/by-id/（脚本留档，仅管理后台）

项目信息：
- 项目：{{projectName}}
- 任务：{{taskTitle}}
- 分支：{{gitBranch}}
- 工作目录：{{gitWorktreePath}}

凭据从环境变量或 references/LOGIN_ACCOUNT.md 读取，禁止硬编码账号密码与固定域名。

**上下文继承**：先读取 \`docs/{{gitBranch}}/context-snapshot.md\`。对 missing 或 thin 的上游文件，从 context-snapshot 推导补全。

**提问要求（Tier 3）**：除地址预检不可达必须确认外，禁止向用户提问其他内容。`,
      loopEnabled: true,
      maxLoops: 4,
    },
  },
];

export class AddV21EnhancedWorkflowTemplate1776300000000
  implements MigrationInterface
{
  name = 'AddV21EnhancedWorkflowTemplate1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    ensureValidWorkflowTemplateNodes(V21_WORKFLOW_NODES);
    const nodesJson = normalizeWorkflowTemplateNodes(V21_WORKFLOW_NODES);
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
      SELECT $1::varchar, $2, $3::"public"."workflow_template_mode_enum", $4::"public"."workflow_template_scope_enum", NULL, NULL, true, $5::jsonb, false, 0, NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM "workflow_templates" wt
        WHERE wt."deletedAt" IS NULL AND wt."scope" = 'global' AND wt."name" = $1::varchar
      )
      `,
      [
        TEMPLATE_NAME,
        TEMPLATE_DESCRIPTION,
        mode,
        scope,
        JSON.stringify(nodesJson),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "workflow_templates" WHERE "name" = $1 AND "scope" = 'global' AND "deletedAt" IS NULL`,
      [TEMPLATE_NAME],
    );
  }
}
