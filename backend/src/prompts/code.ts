/**
 * 代码生成提示词
 */

export const CODE_SYSTEM_PROMPT = `
你不是通用 AI 助手，也不是代码建议者。

你是一个【强约束 · 代码生成执行器（Code Generation Executor）】。

你的唯一职责是：
【将系统设计文档（DESIGN.md）逐字、逐结构、逐约束地转化为可运行的生产级代码】。

━━━━━━━━━━━━━━━━━━━━━━
【最高优先级原则（不可违反）】
━━━━━━━━━━━━━━━━━━━━━━

1. DESIGN.md 是【唯一事实来源】  
   - 任何未在 DESIGN.md 中明确出现的内容，均视为【不存在】
   - 你不得使用常识、经验或“行业最佳实践”补全设计

2. 严禁以下行为（出现任意一条即视为失败）：
   - 推断或补充 DESIGN 中未定义的字段、接口、目录、依赖
   - 使用 DESIGN 未声明的库、框架、工具、语法特性
   - 修改、合并、简化 DESIGN 中定义的结构
   - 输出 TODO、...、伪代码、占位注释
   - 输出解释性文字或说明性段落

3. 当出现以下情况时，你必须【终止代码生成】，并返回错误：
   - DESIGN 信息不完整，无法确定唯一实现
   - DESIGN 与 TASK / PRD 之间存在冲突
   - 技术栈、目录结构、数据模型或 API 定义不清晰
   - 无法 100% 确认你的实现与 DESIGN 完全一致

━━━━━━━━━━━━━━━━━━━━━━
【执行流程（强制）】
━━━━━━━━━━━━━━━━━━━━━━

你在内部必须严格执行以下流程（不需要对用户展示思考）：

Step 1：DESIGN 完整性校验  
- 是否包含：技术栈、目录结构、数据模型、API 定义  
- 不完整 → 失败

Step 2：文档一致性校验  
- 优先级：DESIGN > TASK > PRD  
- 任意冲突 → 失败

Step 3：实现映射校验  
- 每一个文件、类、字段、接口，都必须能在 DESIGN 中找到对应定义

Step 4：代码生成  
- 仅生成 DESIGN 明确要求的文件
- 文件路径、命名、数量必须完全一致
- **前端代码必须生成到 frontend/ 目录下**
- **后端代码必须生成到 backend/ 目录下**

Step 5：生成后自检  
- 是否使用了 DESIGN 外内容？→ 失败  
- 是否缺失 DESIGN 要求的文件？→ 失败  
- 前端代码是否在 frontend/ 目录下？→ 失败
- 后端代码是否在 backend/ 目录下？→ 失败

━━━━━━━━━━━━━━━━━━━━━━
【唯一允许的输出协议】
━━━━━━━━━━━━━━━━━━━━━━

你【只能】使用以下格式输出代码：

===== FILE: <相对路径> =====
    <完整、可运行、无缺失的代码 >
===== END FILE =====

输出规则：
- 每个文件一个 FILE 块
- 不允许在 FILE 块之外输出任何内容
- 不允许 Markdown 代码块
- 不允许解释、总结、说明
- 文件顺序需符合目录结构逻辑顺序
- **前端文件路径必须以 frontend/ 开头（如：frontend/src/views/Home.vue）**
- **后端文件路径必须以 backend/ 开头（如：backend/src/models/User.ts）**

━━━━━━━━━━━━━━━━━━━━━━
【质量基线】
━━━━━━━━━━━━━━━━━━━━━━

- 代码必须可直接运行
    - 必须包含必要的错误处理
    - 必须符合对应语言的工程规范
    - 一致性永远高于“更优实现”

【再次强调：一致性 > 正确性 > 性能 > 优化】
`;

/**
 * 构建代码生成提示词
 * @param design 系统设计文档（DESIGN.md）
 * @returns 代码生成提示词
 */
export function buildCodePrompt(design: string): string {
    return `━━━━━━━━━━━━━━━━━━━━━━
  【强制实现规则】
  ━━━━━━━━━━━━━━━━━━━━━━

1. 技术栈
    - 只能使用 ${design} 中明确声明的技术与版本
        - 禁止引入任何未声明的依赖

2. 目录结构
    - 文件路径必须与 ${design} 完全一致
        - 不得新增、删除、合并、重命名目录或文件

3. 数据模型
    - 字段名、类型、可空性、关系必须逐字一致
        - 不得添加冗余字段或默认字段

4. API
    - 路径、HTTP 方法、参数、返回结构必须完全一致
        - 不得新增隐藏接口或调试接口

5. 完整性
    - 不允许使用 TODO、...、伪代码
        - 每个文件必须是完整实现
  
  ━━━━━━━━━━━━━━━━━━━━━━
  【失败即终止】
  ━━━━━━━━━━━━━━━━━━━━━━

如有任何不确定性，请直接返回错误，不要生成代码。
`;
}
/**
 * 构建包含PRD、DESIGN、TASKS三个标准文档的代码生成提示词
 * @param design 系统设计文档（DESIGN.md）
 * @param prd 产品需求文档（PRD），可选
 * @param taskBreakdown 任务拆分文档（TASK_BREAKDOWN.md），可选
 */
export function buildCodePromptWithStandardDocs(
    design: string,
    prd?: string,
    taskBreakdown?: string
): string {
    let prompt = `# 代码生成标准文档（强约束）\n\n`;

    prompt += `【文档优先级（不可违反）】\n`;
    prompt += `1. DESIGN.md（最高）\n`;
    prompt += `2. TASK_BREAKDOWN.md\n`;
    prompt += `3. PRD\n\n`;

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【1. 系统设计文档（DESIGN.md）】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `${design} \n\n`;

    if (taskBreakdown) {
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `【2. 任务拆分文档（TASK_BREAKDOWN.md）】\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        prompt += `${taskBreakdown} \n\n`;
    }

    if (prd) {
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `【3. 产品需求文档（PRD）】\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        prompt += `${prd} \n\n`;
    }

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【实现铁律】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `- 所有代码必须以 DESIGN.md 为准\n`;
    prompt += `- TASK / PRD 只能作为补充，不得覆盖 DESIGN\n`;
    prompt += `- 任意冲突必须终止生成\n`;
    prompt += `- 禁止任何形式的自由发挥\n\n`;

    // 提取前后端文件清单，明确要求生成
    const { frontendFiles, backendFiles, configFiles } = extractFileListFromDesign(design);

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【必须生成的代码范围】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (frontendFiles.length > 0) {
        prompt += `** 前端代码（必须生成）：**\n`;
        prompt += `DESIGN文档要求生成以下前端文件（共${frontendFiles.length} 个）：\n`;
        prompt += frontendFiles.slice(0, 10).map(f => `- ${f} `).join('\n');
        if (frontendFiles.length > 10) {
            prompt += `\n... 还有 ${frontendFiles.length - 10} 个前端文件\n`;
        }
        prompt += `\n`;
    }

    if (backendFiles.length > 0) {
        prompt += `** 后端代码（必须生成）：**\n`;
        prompt += `DESIGN文档要求生成以下后端文件（共${backendFiles.length} 个）：\n`;
        prompt += backendFiles.slice(0, 10).map(f => `- ${f} `).join('\n');
        if (backendFiles.length > 10) {
            prompt += `\n... 还有 ${backendFiles.length - 10} 个后端文件\n`;
        }
        prompt += `\n`;
    }

    if (configFiles.length > 0) {
        prompt += `** 配置文件（必须生成）：**\n`;
        prompt += configFiles.map(f => `- ${f} `).join('\n');
        prompt += `\n\n`;
    }

    prompt += `** 重要要求：**\n`;
    prompt += `1. 必须同时生成前端代码和后端代码，不能只生成其中一种\n`;
    prompt += `2. 前端代码必须包含所有页面组件、通用组件、API文件、工具函数等\n`;
    prompt += `3. 后端代码必须包含所有模型、控制器、路由、中间件等\n`;
    prompt += `4. 必须生成所有配置文件（package.json、tsconfig.json等）\n`;
    prompt += `5. 如果DESIGN文档中同时包含前端和后端设计，你必须生成完整的全栈代码\n\n`;

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【目录结构要求（强制）】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `**前端代码目录要求：**\n`;
    prompt += `- 所有前端文件必须生成到 frontend/ 目录下\n`;
    prompt += `- 前端文件路径格式：frontend/src/views/xxx.vue、frontend/src/components/xxx.vue 等\n`;
    prompt += `- 前端配置文件路径格式：frontend/package.json、frontend/tsconfig.json 等\n\n`;
    prompt += `**后端代码目录要求：**\n`;
    prompt += `- 所有后端文件必须生成到 backend/ 目录下\n`;
    prompt += `- 后端文件路径格式：backend/src/models/xxx.ts、backend/src/controllers/xxx.ts 等\n`;
    prompt += `- 后端配置文件路径格式：backend/package.json、backend/tsconfig.json 等\n\n`;
    prompt += `**示例：**\n`;
    prompt += `- 前端组件：frontend/src/components/Button.vue ✅\n`;
    prompt += `- 前端页面：frontend/src/views/Home.vue ✅\n`;
    prompt += `- 后端模型：backend/src/models/User.ts ✅\n`;
    prompt += `- 后端控制器：backend/src/controllers/UserController.ts ✅\n`;
    prompt += `- ❌ 错误示例：src/views/Home.vue（缺少 frontend/ 前缀）\n`;
    prompt += `- ❌ 错误示例：src/models/User.ts（缺少 backend/ 前缀）\n\n`;

    prompt += `如无法 100% 确定实现方式，请返回错误。\n`;

    return prompt;
}

/**
 * 构建任务描述提示词
 * @param task 任务对象
 * @param taskBreakdownContent 任务拆分文档内容，可选
 */
export function buildTaskDescriptionPrompt(
    task: {
        id: string;
        name: string;
        type: string;
        priority: string;
        estimatedHours: number;
        dependencies?: string[];
        description: string;
        inputs?: string[];
        outputs?: string[];
        acceptanceCriteria?: string[];
        technicalPoints?: string[];
    },
    _taskBreakdownContent?: string
): string {
    let prompt = `# 任务执行指令\n\n`;

    prompt += `【重要】此任务来源于 TASK_BREAKDOWN.md，不得偏离任务定义。\n\n`;

    prompt += `任务ID：${task.id}\n`;
    prompt += `任务名称：${task.name}\n`;
    prompt += `任务类型：${task.type}\n`;
    prompt += `优先级：${task.priority}\n`;
    prompt += `预估工时：${task.estimatedHours} 小时\n\n`;

    if (task.dependencies?.length) {
        prompt += `依赖任务：${task.dependencies.join(', ')}\n\n`;
    }

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【任务描述】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `${task.description}\n\n`;

    if (task.acceptanceCriteria?.length) {
        prompt += `【验收标准】\n`;
        prompt += task.acceptanceCriteria.map(c => `- ${c}`).join('\n');
        prompt += `\n\n`;
    }

    if (task.technicalPoints?.length) {
        prompt += `【技术要点】\n`;
        prompt += task.technicalPoints.map(t => `- ${t}`).join('\n');
        prompt += `\n\n`;
    }

    prompt += `必须确保：\n`;
    prompt += `- 不超出 DESIGN 定义范围\n`;
    prompt += `- 不引入额外依赖\n`;
    prompt += `- 满足所有验收标准\n\n`;

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【目录结构要求（强制）】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `**前端代码目录要求：**\n`;
    prompt += `- 所有前端文件必须生成到 frontend/ 目录下\n`;
    prompt += `- 前端文件路径格式：frontend/src/views/xxx.vue、frontend/src/components/xxx.vue 等\n\n`;
    prompt += `**后端代码目录要求：**\n`;
    prompt += `- 所有后端文件必须生成到 backend/ 目录下\n`;
    prompt += `- 后端文件路径格式：backend/src/models/xxx.ts、backend/src/controllers/xxx.ts 等\n\n`;
    prompt += `**输出格式：**\n`;
    prompt += `===== FILE: <路径> =====\n`;
    prompt += `<完整代码内容>\n`;
    prompt += `===== END FILE =====\n\n`;
    prompt += `**重要：前端文件路径必须以 frontend/ 开头，后端文件路径必须以 backend/ 开头！**\n\n`;

    return prompt;
}

export function parseCodeFiles(codeOutput: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    // 匹配模式：===== FILE: path =====
    const filePattern = /={5,}\s*FILE:\s*(.+?)\s*={5,}\n([\s\S]*?)={5,}\s*END FILE\s*={5,}/gi;

    let match;
    while ((match = filePattern.exec(codeOutput)) !== null) {
        files.push({
            path: match[1].trim(),
            content: match[2].trim(),
        });
    }

    // 备用方案：如果没有找到文件标记，尝试检测代码块
    if (files.length === 0) {
        const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
        let blockMatch;
        let index = 0;

        while ((blockMatch = codeBlockPattern.exec(codeOutput)) !== null) {
            const language = blockMatch[1] || 'txt';
            const content = blockMatch[2].trim();

            files.push({
                path: `file_${index}.${getExtensionForLanguage(language)}`,
                content: content,
            });

            index++;
        }
    }

    return files;
}

function getExtensionForLanguage(language: string): string {
    const extensions: Record<string, string> = {
        typescript: 'ts',
        javascript: 'js',
        html: 'html',
        css: 'css',
        json: 'json',
        markdown: 'md',
    };

    return extensions[language.toLowerCase()] || 'js';
}

/**
 * 代码完整性检测系统提示词
 */
export const CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT = `
你是一位代码质量审查专家，专门检测代码是否完整生成。

你的职责是：
1. 检测代码中是否存在不完整的标记（TODO、...、占位符等）
2. 检测代码是否缺少必要的实现
3. 检测代码是否符合完整性要求

检测规则：
- 如果代码包含 TODO、FIXME、XXX、...、占位符、伪代码等不完整标记，返回不完整
- 如果代码包含未实现的函数或类，返回不完整
- 如果代码包含注释掉的实现代码，返回不完整
- 如果代码结构完整且无占位符，返回完整

输出格式：
- 如果代码完整：返回 "COMPLETE"
- 如果代码不完整：返回 "INCOMPLETE: <具体原因>"
`;

/**
 * 构建代码完整性检测提示词
 * @param codeFiles 生成的代码文件列表
 * @param design 设计文档
 */
export function buildCodeCompletenessCheckPrompt(
    codeFiles: Array<{ path: string; content: string }>,
    design: string
): string {
    const filesSummary = codeFiles.map(f => `文件: ${f.path}\n长度: ${f.content.length} 字符`).join('\n');
    const sampleFiles = codeFiles.slice(0, 3).map(f =>
        `\n===== ${f.path} =====\n${f.content.substring(0, 500)}${f.content.length > 500 ? '...' : ''}\n`
    ).join('\n');

    return `
请检测以下生成的代码是否完整：

【生成的文件列表】
${filesSummary}

【部分文件内容示例】
${sampleFiles}

【设计文档要求】
${design.substring(0, 1000)}${design.length > 1000 ? '...' : ''}

【检测要求】
1. 检查所有文件是否包含 TODO、FIXME、XXX、...、占位符、伪代码等不完整标记
2. 检查代码是否包含未实现的函数、类或方法
3. 检查代码是否符合设计文档的要求
4. 检查代码是否可以直接运行

请返回：
- 如果代码完整：返回 "COMPLETE"
- 如果代码不完整：返回 "INCOMPLETE: <具体原因，列出所有不完整的地方>"
`;
}

/**
 * 构建代码补充提示词（用于多轮对话）
 * @param existingFiles 已生成的代码文件
 * @param issues 检测到的不完整问题
 * @param design 设计文档
 * @param prd PRD文档（可选）
 * @param taskBreakdown 任务拆分文档（可选）
 */
export function buildCodeCompletionPrompt(
    existingFiles: Array<{ path: string; content: string }>,
    issues: string[],
    design: string,
    prd?: string,
    taskBreakdown?: string
): string {
    const existingFilesContent = existingFiles.map(f =>
        `===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`
    ).join('\n\n');

    let prompt = `# 代码补充任务（多轮对话）\n\n`;
    prompt += `**重要：这是多轮对话的补充阶段。你需要基于已有代码进行补充和完善，而不是重新生成所有代码。**\n\n`;

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【已生成的代码文件】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `以下代码已经生成，请基于这些代码进行补充：\n\n`;
    prompt += `${existingFilesContent}\n\n`;

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【检测到的不完整问题】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += issues.map(i => `- ${i}`).join('\n');
    prompt += `\n\n`;

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【补充要求】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `1. **保留已有代码**：不要删除或重写已生成的代码，只补充缺失的部分\n`;
    prompt += `2. **修复不完整标记**：\n`;
    prompt += `   - 移除所有 TODO、FIXME、XXX、HACK 等标记\n`;
    prompt += `   - 移除所有占位符 "..."（包括注释中的占位符和代码中的占位符）\n`;
    prompt += `   - 实现所有空函数体和空类\n`;
    prompt += `   - 确保所有代码都是完整可运行的实现，不要留下任何占位符\n`;
    prompt += `3. **补充缺失实现**：实现所有未完成的函数、类和方法\n`;
    prompt += `4. **保持一致性**：确保补充的代码与已有代码风格一致\n`;
    prompt += `5. **完整性检查**：确保所有代码都可以直接运行\n`;
    prompt += `6. **前后端完整性**：必须确保前端代码和后端代码都完整生成\n`;
    prompt += `7. **目录结构**：前端代码必须在 frontend/ 目录下，后端代码必须在 backend/ 目录下\n\n`;
    prompt += `**特别强调：**\n`;
    prompt += `- 如果检测到注释中有 "// ..." 这样的占位符，你必须将其替换为完整的代码实现\n`;
    prompt += `- 如果检测到代码中有独立的 "..." 占位符，你必须将其替换为完整的代码实现\n`;
    prompt += `- 不要使用任何形式的占位符，所有代码都必须是完整可运行的\n\n`;

    // 检查缺失的文件类型
    const hasFrontendFiles = existingFiles.some(f =>
        f.path.includes('.vue') ||
        f.path.includes('frontend') ||
        f.path.includes('src/views') ||
        f.path.includes('src/components')
    );
    const hasBackendFiles = existingFiles.some(f =>
        f.path.includes('backend') ||
        f.path.includes('src/models') ||
        f.path.includes('src/controllers') ||
        f.path.includes('src/routes')
    );

    // 从DESIGN文档提取文件清单
    const { frontendFiles, backendFiles } = extractFileListFromDesign(design);

    if (frontendFiles.length > 0 && !hasFrontendFiles) {
        prompt += `**⚠️ 重要：检测到未生成前端代码！**\n`;
        prompt += `DESIGN文档要求生成前端代码，但当前没有生成任何前端文件。\n`;
        prompt += `你必须立即生成所有前端代码文件，包括：\n`;
        prompt += frontendFiles.slice(0, 5).map(f => `- frontend/${f.replace(/^frontend\//, '')}`).join('\n');
        if (frontendFiles.length > 5) {
            prompt += `\n... 以及所有其他前端文件\n`;
        }
        prompt += `\n**重要：所有前端文件路径必须以 frontend/ 开头！**\n\n`;
    }

    if (backendFiles.length > 0 && !hasBackendFiles) {
        prompt += `**⚠️ 重要：检测到未生成后端代码！**\n`;
        prompt += `DESIGN文档要求生成后端代码，但当前没有生成任何后端文件。\n`;
        prompt += `你必须立即生成所有后端代码文件，包括：\n`;
        prompt += backendFiles.slice(0, 5).map(f => `- backend/${f.replace(/^backend\//, '')}`).join('\n');
        if (backendFiles.length > 5) {
            prompt += `\n... 以及所有其他后端文件\n`;
        }
        prompt += `\n**重要：所有后端文件路径必须以 backend/ 开头！**\n\n`;
    }

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【设计文档参考】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `${design.substring(0, 2000)}${design.length > 2000 ? '...' : ''}\n\n`;

    if (prd) {
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `【PRD参考】\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        prompt += `${prd.substring(0, 1000)}${prd.length > 1000 ? '...' : ''}\n\n`;
    }

    if (taskBreakdown) {
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `【任务拆分参考】\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        prompt += `${taskBreakdown.substring(0, 1000)}${taskBreakdown.length > 1000 ? '...' : ''}\n\n`;
    }

    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【输出要求】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `请输出完整的代码文件（包括已生成和补充的部分），使用以下格式：\n\n`;
    prompt += `===== FILE: <路径> =====\n`;
    prompt += `<完整代码内容>\n`;
    prompt += `===== END FILE =====\n\n`;
    prompt += `**注意：**\n`;
    prompt += `- 对于已存在的文件，请输出完整的文件内容（包含原有代码和补充代码）\n`;
    prompt += `- **前端文件路径必须以 frontend/ 开头**\n`;
    prompt += `- **后端文件路径必须以 backend/ 开头**\n`;

    return prompt;
}

/**
 * 从DESIGN文档中提取前后端文件清单
 * @param design DESIGN文档内容
 * @returns 前后端文件清单
 */
export function extractFileListFromDesign(design: string): {
    frontendFiles: string[];
    backendFiles: string[];
    configFiles: string[];
} {
    const frontendFiles: string[] = [];
    const backendFiles: string[] = [];
    const configFiles: string[] = [];

    // 提取前端文件清单（从"### 3.4 文件清单"或"### 4.4 前端文件清单"等章节）
    const frontendSectionMatch = design.match(/##\s*[34]\.\s*前端[^#]*(?:文件清单|工程结构)[\s\S]*?(?=##|$)/i);
    if (frontendSectionMatch) {
        const frontendSection = frontendSectionMatch[0];
        // 提取代码块中的文件路径
        const codeBlockMatch = frontendSection.match(/```[\s\S]*?```/g);
        if (codeBlockMatch) {
            codeBlockMatch.forEach(block => {
                const filePaths = block.match(/(?:src\/|public\/|\.\/)?[\w\/\-\.]+\.(vue|ts|js|tsx|jsx|json|html|css|scss)/gi);
                if (filePaths) {
                    frontendFiles.push(...filePaths.map(p => p.trim()));
                }
            });
        }
        // 提取列表中的文件
        const listItems = frontendSection.match(/-.*?`([^`]+)`/g);
        if (listItems) {
            listItems.forEach(item => {
                const filePath = item.match(/`([^`]+)`/)?.[1];
                if (filePath && !frontendFiles.includes(filePath)) {
                    frontendFiles.push(filePath);
                }
            });
        }
    }

    // 提取后端文件清单（从"### 4.3 代码结构"或"### 4.4 文件清单"等章节）
    const backendSectionMatch = design.match(/##\s*4\.\s*后端[^#]*(?:代码结构|文件清单)[\s\S]*?(?=##|$)/i);
    if (backendSectionMatch) {
        const backendSection = backendSectionMatch[0];
        // 提取代码块中的文件路径
        const codeBlockMatch = backendSection.match(/```[\s\S]*?```/g);
        if (codeBlockMatch) {
            codeBlockMatch.forEach(block => {
                const filePaths = block.match(/(?:src\/|\.\/)?[\w\/\-\.]+\.(ts|js|json)/gi);
                if (filePaths) {
                    backendFiles.push(...filePaths.map(p => p.trim()));
                }
            });
        }
        // 提取列表中的文件
        const listItems = backendSection.match(/-.*?`([^`]+)`/g);
        if (listItems) {
            listItems.forEach(item => {
                const filePath = item.match(/`([^`]+)`/)?.[1];
                if (filePath && !backendFiles.includes(filePath)) {
                    backendFiles.push(filePath);
                }
            });
        }
    }

    // 提取配置文件
    const configPatterns = [
        /package\.json/gi,
        /tsconfig\.json/gi,
        /vite\.config\.(ts|js)/gi,
        /\.env/gi,
        /\.gitignore/gi,
        /README\.md/gi,
    ];
    configPatterns.forEach(pattern => {
        const matches = design.match(pattern);
        if (matches) {
            matches.forEach(match => {
                if (!configFiles.includes(match)) {
                    configFiles.push(match);
                }
            });
        }
    });

    return {
        frontendFiles: [...new Set(frontendFiles)],
        backendFiles: [...new Set(backendFiles)],
        configFiles: [...new Set(configFiles)],
    };
}

/**
 * 检测代码是否包含不完整标记
 * @param codeContent 代码内容
 * @returns 检测结果
 */
export function checkCodeCompleteness(codeContent: string): {
    isComplete: boolean;
    issues: string[];
} {
    const issues: string[] = [];

    // 更精确的不完整标记检测
    const incompletePatterns = [
        /\bTODO\b/i,
        /\bFIXME\b/i,
        /\bXXX\b/i,
        /\bHACK\b/i,
        /placeholder/i,
        /伪代码/i,
        /待实现/i,
        /未实现/i,
        /not implemented/i,
        /coming soon/i,
        // 移除对注释中 ... 的检测，因为可能是正常的说明性注释
        // /\/\*\s*\.\.\.\s*\*\//, // 注释中的 ...
        /\{\s*\.\.\.\s*\}/, // 对象字面量中的 ...
        /function\s+\w+\s*\(\s*\)\s*\{\s*\}/, // 空函数体
        /class\s+\w+\s*\{\s*\}/, // 空类
    ];

    for (const pattern of incompletePatterns) {
        const matches = codeContent.match(pattern);
        if (matches) {
            issues.push(`发现不完整标记: ${pattern.toString()}`);
        }
    }

    // 检测注释中的 ... 占位符（如 // ... 其他导入）
    // 但排除明显的说明性注释（如 "// ... 其他导入"、"// ... 其他代码" 等）
    const commentEllipsisPattern = /\/\/\s*\.\.\.\s*[^\n]*/g;
    const commentEllipsisMatches = codeContent.match(commentEllipsisPattern);
    if (commentEllipsisMatches) {
        // 过滤掉说明性注释，只保留可能是占位符的注释
        const realPlaceholders = commentEllipsisMatches.filter(match => {
            const text = match.toLowerCase();
            // 如果注释包含明确的说明性文字，可能是正常的说明，不算占位符
            const isDescriptive = /其他|其他代码|其他导入|其他配置|其他设置|其他选项|其他参数|其他方法|其他函数|其他类|其他组件|其他文件|省略|省略部分|省略代码|省略导入|省略配置|省略设置|省略选项|省略参数|省略方法|省略函数|省略类|省略组件|省略文件/.test(text);
            // 如果只是单纯的 "// ..." 或 "// ... "，可能是占位符
            return !isDescriptive && text.trim().length <= 10;
        });

        if (realPlaceholders.length > 0) {
            issues.push(`发现注释中的占位符 ... (${realPlaceholders.length}处): ${realPlaceholders.slice(0, 3).join(', ')}`);
        }
    }

    // 检测独立的 ...（占位符），但不包括扩展运算符
    // 扩展运算符通常在特定上下文中：...obj, [...arr], {...obj}
    // 独立的 ... 通常是占位符
    const standaloneEllipsisPattern = /(?:^|\s|\(|\[|,|;)\s*\.\.\.\s*(?:$|\s|\)|\]|,|;)/gm;
    const standaloneEllipsisMatches = codeContent.match(standaloneEllipsisPattern);
    if (standaloneEllipsisMatches) {
        // 过滤掉可能是扩展运算符的情况和注释中的情况
        const realPlaceholders = standaloneEllipsisMatches.filter(match => {
            const matchIndex = codeContent.indexOf(match);
            // 检查是否在注释中（单行注释或多行注释）
            const beforeMatch = codeContent.substring(Math.max(0, matchIndex - 100), matchIndex);
            if (/\/\/[^\n]*$/.test(beforeMatch.split('\n').pop() || '') || /\/\*[\s\S]*$/.test(beforeMatch)) {
                return false; // 已经在注释检测中处理
            }

            // 检查前后文，排除扩展运算符的情况
            const afterMatch = codeContent.substring(matchIndex + match.length, Math.min(codeContent.length, matchIndex + match.length + 20));

            // 如果前后有变量名、对象属性等，可能是扩展运算符，跳过
            if (/\w+\s*\.\.\./.test(beforeMatch + match) || /\.\.\.\s*\w+/.test(match + afterMatch)) {
                return false;
            }
            // 如果是在数组或对象字面量中，可能是扩展运算符
            if (/\[.*\.\.\./.test(beforeMatch + match) || /\{.*\.\.\./.test(beforeMatch + match)) {
                return false;
            }
            return true;
        });

        if (realPlaceholders.length > 0) {
            issues.push(`发现占位符 ... (${realPlaceholders.length}处)`);
        }
    }

    // 检查是否有未实现的函数（只有声明没有实现）
    const functionDeclarations = codeContent.match(/(?:function|const|let|var)\s+(\w+)\s*[=:]?\s*\([^)]*\)\s*\{?\s*$/gm);
    if (functionDeclarations) {
        for (const decl of functionDeclarations) {
            // 检查是否有对应的实现
            const funcName = decl.match(/(?:function|const|let|var)\s+(\w+)/)?.[1];
            if (funcName) {
                const implementation = codeContent.match(new RegExp(`(?:function|const|let|var)\\s+${funcName}\\s*[=:]?\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{10,}`, 'm'));
                if (!implementation) {
                    issues.push(`函数 ${funcName} 可能未实现`);
                }
            }
        }
    }

    return {
        isComplete: issues.length === 0,
        issues,
    };
}

/**
 * 检测前后端代码完整性
 * @param generatedFiles 已生成的代码文件列表
 * @param design DESIGN文档内容
 * @returns 检测结果
 */
export function checkFrontendBackendCompleteness(
    generatedFiles: Array<{ path: string; content: string }>,
    design: string
): {
    isComplete: boolean;
    issues: string[];
    frontendMissing: string[];
    backendMissing: string[];
    configMissing: string[];
} {
    const issues: string[] = [];
    const generatedPaths = generatedFiles.map(f => f.path.toLowerCase());

    // 从DESIGN文档提取文件清单
    const { frontendFiles, backendFiles, configFiles } = extractFileListFromDesign(design);

    // 检查前端文件
    const frontendMissing: string[] = [];
    frontendFiles.forEach(file => {
        const normalizedFile = file.toLowerCase().replace(/^src\//, '').replace(/^\.\//, '');
        const found = generatedPaths.some(path =>
            path.includes(normalizedFile) ||
            path.endsWith(normalizedFile) ||
            normalizedFile.includes(path.split('/').pop() || '')
        );
        if (!found) {
            frontendMissing.push(file);
        }
    });

    // 检查后端文件
    const backendMissing: string[] = [];
    backendFiles.forEach(file => {
        const normalizedFile = file.toLowerCase().replace(/^src\//, '').replace(/^\.\//, '');
        const found = generatedPaths.some(path =>
            path.includes(normalizedFile) ||
            path.endsWith(normalizedFile) ||
            normalizedFile.includes(path.split('/').pop() || '')
        );
        if (!found) {
            backendMissing.push(file);
        }
    });

    // 检查配置文件
    const configMissing: string[] = [];
    configFiles.forEach(file => {
        const normalizedFile = file.toLowerCase();
        const found = generatedPaths.some(path =>
            path.includes(normalizedFile) ||
            path.endsWith(normalizedFile)
        );
        if (!found) {
            configMissing.push(file);
        }
    });

    // 生成问题列表
    if (frontendMissing.length > 0) {
        issues.push(`前端缺失文件 (${frontendMissing.length}个): ${frontendMissing.slice(0, 5).join(', ')}${frontendMissing.length > 5 ? '...' : ''}`);
    }
    if (backendMissing.length > 0) {
        issues.push(`后端缺失文件 (${backendMissing.length}个): ${backendMissing.slice(0, 5).join(', ')}${backendMissing.length > 5 ? '...' : ''}`);
    }
    if (configMissing.length > 0) {
        issues.push(`配置文件缺失 (${configMissing.length}个): ${configMissing.join(', ')}`);
    }

    // 检查是否有前端代码（优先检查 frontend/ 前缀）
    const hasFrontend = generatedPaths.some(path =>
        path.startsWith('frontend/') ||
        path.includes('frontend/') ||
        (path.includes('.vue') && path.includes('frontend')) ||
        path.includes('src/views') ||
        path.includes('src/components')
    );

    // 检查是否有后端代码（优先检查 backend/ 前缀）
    const hasBackend = generatedPaths.some(path =>
        path.startsWith('backend/') ||
        path.includes('backend/') ||
        (path.includes('backend') && (path.includes('.ts') || path.includes('.js'))) ||
        path.includes('src/models') ||
        path.includes('src/controllers') ||
        path.includes('src/routes')
    );

    if (!hasFrontend && frontendFiles.length > 0) {
        issues.push('未生成任何前端代码文件');
    }
    if (!hasBackend && backendFiles.length > 0) {
        issues.push('未生成任何后端代码文件');
    }

    return {
        isComplete: issues.length === 0,
        issues,
        frontendMissing,
        backendMissing,
        configMissing,
    };
}

/**
 * 代码审查系统提示词
 * 
 * 用于指导 AI 如何审查代码质量、可读性、可维护性等。
 * 
 * @usedBy CodeReview Action
 */
export const CODE_REVIEW_SYSTEM_PROMPT = `
你是一位资深代码审查专家（Code Reviewer），
拥有丰富的代码审查经验，擅长发现代码问题并提供改进建议。

你的职责包括：
- 审查代码质量、可读性、可维护性
- 检查代码是否符合设计规范和最佳实践
- 识别潜在的性能问题和安全隐患
- 提供具体的改进建议和代码示例

你必须遵循以下原则：
- 客观、专业、建设性
- 关注代码质量而非个人偏好
- 提供可操作的建议
- 平衡代码质量和开发效率
`;

/**
 * 构建代码审查提示词
 * 
 * @param code - 待审查的代码内容
 * @param taskDescription - 任务描述
 * @param design - 设计文档（可选）
 * @returns 代码审查的用户提示词
 * @usedBy CodeReview Action
 */
export function buildCodeReviewPrompt(code: string, taskDescription: string, design?: string): string {
  return `
你将审查以下代码，并提供详细的代码审查报告。

【任务描述】
${taskDescription}

${design ? `【设计文档】\n${design}\n` : ''}

【代码内容】
${code}

【审查要求】
1. 代码质量审查：
   - 代码结构和组织
   - 命名规范
   - 代码可读性
   - 错误处理

2. 技术审查：
   - 是否符合设计规范
   - 性能优化建议
   - 安全性检查
   - 最佳实践遵循情况

3. 功能审查：
   - 是否满足任务要求
   - 边界条件处理
   - 异常情况处理

4. 输出格式：
   - 总体评价
   - 优点总结
   - 问题列表（按优先级）
   - 改进建议（含代码示例）
   - 评分（1-10分）

现在开始进行代码审查。
`;
}

/**
 * 构建 Cursor CLI 代码审查提示词
 * 用于 CLI 模式下的代码审查，CLI 会自动读取当前目录下的代码文件
 * @returns Cursor CLI 代码审查提示词
 */
export function buildCursorCLICodeReviewPrompt(): string {
  return `请审查当前项目目录下的代码，并提供详细的代码审查报告。

【审查要求】
1. 代码质量审查：
   - 代码结构和组织
   - 命名规范
   - 代码可读性
   - 错误处理

2. 技术审查：
   - 是否符合最佳实践
   - 性能优化建议
   - 安全性检查
   - 代码风格一致性

3. 功能审查：
   - 代码逻辑正确性
   - 边界条件处理
   - 异常情况处理

4. 输出格式：
   - 总体评价
   - 优点总结
   - 问题列表（按优先级排序）
   - 改进建议（包含具体代码修改建议）
   - 综合评分（1-10分）

请开始进行代码审查。`;
}

/**
 * 构建详细的 OpenSpec Apply 提示词
 * 包含模板替换、代码完整性、任务标记等详细要求
 * @returns 详细的 apply 命令提示词
 */
export function buildOpenSpecApplyPrompt(): string {
  return `# OpenSpec 实施任务执行规范

执行 /openspec-apply 命令，完成 tasks.md 中的所有任务。

## 第一步：初始模板页面识别与替换（最高优先级，必须先执行）

在生成任何代码前，必须完成初始模板的替换：

### 1.1 检查常见页面位置

**必须检查以下常见模板页面**（无论是否在 tasks.md 中提到）：

**PC端** (ainative-pc/src/views/)：
- HomeView.vue - 首页
- AboutView.vue - 关于页面
- 其他 *View.vue 文件

**移动端** (ainative-app/src/pages/)：
- index/index.vue - 首页
- about/index.vue - 关于页面
- 其他页面文件

**管理后台** (ainative-shadow/src/views/)：
- home/index.vue 或 HomeView.vue - 首页
- 其他页面文件

### 1.2 主动识别初始模板特征

读取上述文件，检查是否包含**初始脚手架模板的特征**：

**初始模板特征关键词**（任一匹配即为初始模板，需要替换）：

**unibest 模板特征**：
- 包含 "unibest"、"菲鸽"、"最好用的 uniapp 开发模板"
- 包含 "https://unibest.tech" 等模板官网链接

**AINative 模板特征**：
- 包含 "AINative Workspace"、"AINative PC"、"AINative 移动端"
- 包含 "企业级 AI 原生协作"、"AI Native Enterprise OS"
- 包含 "让 AI 原生落地到企业"
- 标题或描述为通用的 "全栈应用的管理后台"、"全栈应用的工作空间"、"移动端应用"

**虚构示例数据**：
- 包含虚构的公司名：天衡集团、星澜零售、云泊物流、澄澜科技、海岸能源、卓信研究院
- 包含通用的演示描述："查看路由配置，开始构建您的应用"、"探索各种功能模块和组件"、"参考文档了解开发规范"

**明确标识**：
- 页面中明确包含 "模板"、"template"、"示例"、"demo"、"演示"、"占位" 等词

**重要**：如果页面内容看起来是真实的业务内容（即使不是本次 tasks.md 的需求），不应判断为模板。只有明确包含上述初始模板特征的页面才需要替换。

### 1.3 列出需要替换的页面

执行检查后，**明确列出**需要替换的初始模板页面：

\`\`\`
需要替换的初始模板页面：
1. ainative-pc/src/views/HomeView.vue - 原因：包含 AINative 企业协作平台营销内容
2. ainative-pc/src/views/AboutView.vue - 原因：包含通用的关于页面模板
3. ainative-app/src/pages/index/index.vue - 原因：包含 unibest 模板介绍
...
\`\`\`

**重要说明**：
- **只列出**包含初始模板特征的页面
- **不列出**已经是真实业务内容的页面（即使内容简单或不是本次任务的）
- 如果所有常见页面都已是真实业务内容，清单可以为空

### 1.4 完整替换所有初始模板页面

**重要前提**：
- **只替换**步骤 1.3 中列出的初始模板页面
- **不修改**已经是真实业务内容的页面（即使内容简单或与本次任务无关）
- 如果步骤 1.3 的清单为空，跳过此步骤，直接进入第二步

**替换原则**：
- ✅ **必须替换**识别出的初始模板页面内容，而不是创建新页面
- ✅ 根据 tasks.md 的实际需求，编写真实的业务内容
- ✅ 完全删除初始模板的演示文案、虚构数据、示例组件
- ✅ 确保替换后不再包含任何初始模板特征

**替换首页时的特别要求（必须主动思考）**：

替换首页前，**必须主动思考并判断**：

**步骤1：分析本次开发的功能类型**
- 是面向用户的功能吗？（如计算器、看板、表单、任务管理等）
- 还是后台功能？（如 API 接口、数据模型、工具类、配置等）

**步骤2：判断是否需要首页入口**
- ✅ **需要入口**：面向用户的前端功能（如计算器、任务管理、数据看板等）
- ❌ **不需要入口**：后台 API、数据模型、工具函数、配置项等

**步骤3：如果需要入口，则添加访问方式**

**检查现有入口**：
- 如果首页已经有该功能的入口（从上次执行保留的），不要重复添加
- 只有在缺少入口时，才添加新的访问方式

**添加入口时**，替换后的首页应该：
1. 提供该功能的访问入口（按钮、卡片、导航链接等）
2. 简要介绍该功能
3. 确保用户可以方便地访问到新功能

**判断示例**：

✅ **需要添加入口的场景**：
- 开发了计算器功能 → 首页添加 "计算器" 按钮/卡片，跳转到 /calculator
- 开发了任务管理系统 → 首页添加 "任务管理" 入口
- 开发了数据可视化看板 → 首页添加 "数据看板" 入口

❌ **不需要添加入口的场景**：
- 开发了 API 接口（如 /api/users） → 不需要在首页添加
- 创建了数据模型（如 User、Task 表结构） → 不需要在首页添加
- 实现了工具函数（如加密解密） → 不需要在首页添加

**严格禁止**：
- ❌ 检测到初始模板但不替换，直接创建新页面
- ❌ 只修改部分内容，保留初始模板的框架或演示数据
- ❌ 认为"该模板页面与本次任务无关"而跳过（必须替换为真实业务内容）
- ❌ 未经思考和判断，机械地替换首页（必须先分析功能类型，再决定是否添加入口）
- ❌ 修改已经是真实业务内容的页面（即使内容简单或与本次任务无关）
- ❌ 重复添加已经存在的功能入口

### 1.5 验证替换结果

替换完成后，**必须验证**：

1. 再次读取被替换的页面
2. 确认不再包含初始模板特征关键词（unibest、菲鸽、AINative Workspace、AINative PC、虚构公司名、通用演示描述等）
3. 确认页面已更新为真实的业务内容（而非初始脚手架的演示内容）
4. **验证功能访问性**：
   - 如果判断本次功能需要首页入口（如计算器等面向用户的功能），确认首页已提供访问入口
   - 如果判断不需要首页入口（如后台 API），确认首页内容合理即可
5. 如发现残留初始模板特征，立即修正

## 第二步：理解任务要求

1. 仔细阅读 openspec/changes/*/proposal.md、design.md、tasks.md
2. 理解每个任务的具体要求和验收标准
3. 明确区分"设计任务"和"实现任务"

## 第三步：代码生成标准（强制要求）

### 禁止行为（违反任一项即失败）

❌ **禁止输出不完整标记**：
   - TODO、FIXME、XXX、HACK
   - ...（占位符）
   - 伪代码、代码片段
   - "// 其他代码类似"等注释

❌ **禁止框架式实现**：
   - 只创建接口/类定义
   - 空函数体：\`function foo() {}\`
   - 空类：\`class Bar {}\`
   - 未实现的方法

❌ **禁止简化逻辑**：
   - 省略错误处理
   - 忽略边界条件
   - 缺少异常处理
   - 缺少参数验证

❌ **禁止依赖问题**：
   - 使用未声明的依赖
   - 使用废弃的 API
   - 使用过时的包版本

### 必须达到的标准

✅ **代码必须完整**：
   - 所有函数有完整实现（非空）
   - 所有类有完整方法实现
   - 包含完整的错误处理
   - 包含必要的参数验证
   - 包含边界条件检查

✅ **代码必须可运行**：
   - 可以直接编译/构建
   - 无语法错误
   - 依赖正确引入
   - 构建命令可执行（make api, make wire, npm run generate 等）

✅ **代码必须规范**：
   - 遵循项目代码风格
   - 包含必要的注释
   - 命名规范清晰
   - 文件组织合理

## 第四步：执行顺序（严格按顺序）

### 阶段1：数据层（如有需要）
- 创建 SQL 文件（完整表结构）
- 包含索引、约束、注释
- 验证 SQL 语法正确

### 阶段2：API层（如有需要）
- 创建 Proto/接口定义文件
- 执行代码生成命令（make api 等）
- 验证生成的代码无错误

### 阶段3：业务逻辑层（核心）
- 实现 Service 层（完整业务逻辑）
- 实现 Biz 层（完整业务处理）
- 实现 Data 层（完整数据访问）
- 包含完整的错误处理和日志

### 阶段4：前端实现（如有需要）
- 实现所有页面组件（完整逻辑）
- 实现通用组件
- 实现 API 调用
- 实现状态管理
- 包含完整的错误处理和用户提示

### 阶段5：构建验证
- 执行所有必要的构建命令
- 验证编译通过
- 验证依赖完整
- 检查是否有运行时错误

## 第五步：任务标记规范（严格遵守）

### 核心原则：只有完全完成才能打勾 ✓

**任务标记有三种状态：**

#### 1. 未完成（包括未开始、进行中、部分完成）
\`\`\`
- [ ] 任务名称
\`\`\`
或添加进度说明：
\`\`\`
- [ ] 任务名称 📝 <进度说明>
\`\`\`

**示例**：
- \`- [ ] 1.2 实现用户注册功能\`（未开始）
- \`- [ ] 1.2 实现用户注册功能 📝 API定义完成，Service/Biz/Data层代码待实现\`
- \`- [ ] 2.1 设计任务数据模型 📝 SQL文件已创建，表结构待验证和迁移\`
- \`- [ ] 3.1 实现任务发布功能 📝 接口已创建，业务逻辑实现中\`

#### 2. 完全完成（代码已实现）
\`\`\`
- [x] 任务名称 ✅ 已完整实现
\`\`\`

**完成标准（必须全部满足）**：
- ✅ 代码已完整实现（有具体业务逻辑，非框架/接口）
- ✅ 所有函数/方法有完整实现（非空函数体）
- ✅ 包含完整的错误处理和边界检查
- ✅ 代码已测试可运行
- ✅ 代码已集成到项目
- ✅ 无任何 TODO/占位符/伪代码
- ✅ 构建命令执行成功

**完成示例（可以打 [x]）**：
- \`- [x] 2.2 实现 CalculatorEngine.ts 计算引擎核心逻辑 ✅ 已完整实现\`（引擎所有方法都已实现，包含错误处理）
- \`- [x] 3.2 创建计算器页面 src/pages/calculator/index.vue ✅ 已完整实现\`（页面包含完整UI和业务逻辑）
- \`- [x] 4.8 配置路由（在 src/router/index.ts 中添加） ✅ 已完整实现\`（路由已添加且测试可访问）

#### 3. 需要人工执行或非必须任务
\`\`\`
- [x] 任务名称 ⚠️ 需要人工执行/验证
- [x] 任务名称 ⚠️ 当前版本不需要
- [x] 任务名称 ⚠️ 可选任务
\`\`\`

**重要：必须先尝试执行，只有多次失败后才能标记为"需要人工"**：

以下任务必须先实际执行，不能因预期的环境问题就提前放弃：
- 构建命令（make api、make wire、make gorm、npm run generate 等）
- 代码生成命令（buf generate、protoc 等）
- 依赖安装（npm install、go mod tidy 等）
- 数据库迁移脚本执行（make migrate 等）
- 格式化命令（buf format、go fmt 等）

**标记为"需要人工"的唯一条件**：
1. 已实际执行该命令
2. 执行失败
3. 已尝试分析错误并修复（如安装缺失依赖）
4. 再次执行仍然失败（至少尝试 2-3 次）
5. 确认无法通过代码修改或环境调整解决

**严格禁止**：
- ❌ 因为"protoc-gen-go 未安装"就标记 make api 为人工（应先执行，失败后尝试安装依赖）
- ❌ 因为"环境限制"就标记命令为人工（应先尝试执行）
- ❌ 未实际执行就预判会失败（必须先执行）

**使用场景**（真正需要标记为"需要人工"的）：
- 手动测试（需要真实浏览器/设备环境）
- 部署操作（需要服务器权限）
- 埋点验证（需要真实SDK和数据平台）
- 代码审查、QA测试、性能测试等
- 当前版本不需要的功能（如：支付宝小程序版本测试）
- 可选任务（如：后续优化）

**示例**：
- \`- [x] 3.5.1 手动测试：H5版本功能测试 ⚠️ 需要人工在真实浏览器中测试\`
- \`- [x] 4.11 验证埋点事件上报 ⚠️ 需要集成真实SDK后人工验证\`
- \`- [x] 7.3 部署测试环境 ⚠️ 需要人工部署到测试服务器\`
- \`- [x] 3.5.3 支付宝小程序版本功能测试 ⚠️ 当前版本不需要\`
- \`- [x] 8.1 性能优化 ⚠️ 可选任务\`

**未完成示例（必须保持 [ ]）**：
- \`- [ ] 2.2 实现 CalculatorEngine.ts 计算引擎核心逻辑 📝 文件已创建，方法待实现\`
- \`- [ ] 3.2 创建计算器页面 📝 组件框架已创建，业务逻辑待实现\`
- \`- [ ] 4.11 编写单元测试 📝 测试文件已创建，测试用例待补充\`

### 禁止提前打勾

❌ **严重错误（绝对禁止）**：
- \`- [x] 1.2 实现用户注册功能\`（仅创建了 API 定义）
- \`- [x] 2.1 设计任务数据模型 ⚠️ SQL文件已创建，表结构待迁移\`（未完全完成就打勾）
- \`- [x] 2.3 实现任务发布功能\`（仅创建了接口，无实现）
- \`- [x] 3.1 实现前端页面 ⚠️ 组件框架已创建，业务逻辑待实现\`（未完全完成就打勾）

✅ **正确做法**：
- \`- [ ] 1.2 实现用户注册功能 📝 API定义完成，Service/Biz/Data层代码待实现\`（未完成保持 [ ]）
- \`- [ ] 2.1 设计任务数据模型 📝 SQL文件已创建，表结构待验证和迁移\`（未完成保持 [ ]）
- \`- [x] 4.3 实现任务执行进度跟踪功能 ✅ 已完整实现\`（完全完成才打勾）

## 第六步：最终验证清单（必须全部通过）

在将任务标记为 [x] 完成前，确认以下所有项：

### 模板替换验证
- [ ] ✅ 已检查所有常见模板页面位置（HomeView.vue、AboutView.vue、index/index.vue 等）
- [ ] ✅ 已列出需要替换的初始模板页面清单
- [ ] ✅ 已完整替换所有识别出的初始模板页面
- [ ] ✅ 已验证初始模板特征无残留（unibest、菲鸽、AINative Workspace、AINative PC、虚构公司名、通用演示描述等）
- [ ] ✅ 替换后的页面内容是真实的业务内容（不再是初始脚手架的演示内容）
- [ ] ✅ 已分析功能类型并判断是否需要首页入口
- [ ] ✅ 如需首页入口，已添加合适的访问方式（如计算器按钮/链接）

### 代码质量验证
- [ ] ✅ 所有声称创建的文件确实存在
- [ ] ✅ 所有文件内容完整（无 TODO/占位符/...）
- [ ] ✅ 所有函数有完整实现（非空函数体）
- [ ] ✅ 代码包含完整错误处理和边界检查
- [ ] ✅ 代码可编译/构建成功
- [ ] ✅ 所有依赖正确引入
- [ ] ✅ 构建命令执行成功（make api, make wire, npm run generate 等）

### 任务标记验证
- [ ] ✅ tasks.md 标记准确反映实际情况
- [ ] ✅ 只有完全完成的任务才标记为 [x]，部分完成的保持 [ ]

## 执行要求总结

1. **初始模板替换优先**：必须先检查常见页面位置、识别初始模板特征、列出清单、完整替换、验证结果
2. **只识别初始模板**：只替换包含 unibest、AINative Workspace、AINative PC、虚构公司名等初始脚手架特征的页面，已有真实业务内容的页面不应被当作模板
3. **必须替换而非新增**：禁止保留初始模板页面而创建新页面
4. **保护已替换页面**：如果页面已经是真实业务内容（不包含初始模板特征），不要再次修改，即使内容简单或与本次任务无关
5. **主动判断功能入口**：替换首页时，必须分析功能类型（面向用户 or 后台功能），判断是否需要添加访问入口，如需要且尚未存在则添加
6. **代码必须完整**：禁止 TODO/占位符/空实现/伪代码
7. **代码必须可运行**：可编译、可构建、依赖完整
8. **标记必须严格**：只有完全完成才能打勾 [x]，部分完成保持 [ ] 并可添加 📝 进度说明
9. **验证必须严格**：完成前通过所有验证清单

现在开始执行 /openspec-apply 命令，严格遵守以上所有要求。`;
}

/**
 * 获取 apply 命令提示词
 * 用于执行 openspec-apply 命令并完成所有任务
 * @returns apply 命令提示词
 */
export function getApplyCommand(): string {
    // 支持通过环境变量切换到简化版（用于调试）
    if (process.env.USE_SIMPLE_APPLY_PROMPT === 'true') {
        return "执行/openspec-apply命令，并且自动执行所有必要的构建命令（如make api、make wire、npm run generate等），不要只生成代码就停止，必须完成所有任务直到tasks.md中的任务全部标记为完成。如果遇到模版页面如\"最好用的 uniapp 开发模板\"、\"专注企业级 AI 原生协作\"、\"企业级 AI 原生工作空间\"等页面需要改成本次tasks.md对应页面不能有模版页面相关数据";
    }
    return buildOpenSpecApplyPrompt();
}

/**
 * 获取 check 命令提示词
 * 用于检查 tasks.md 文件中的任务是否全部完成
 * @returns check 命令提示词
 */
export function getCheckCommand(): string {
    return "查找 openspec/changes/ 目录下子文件夹中的 tasks.md 文件（路径模式为 openspec/changes/*/tasks.md），检查里面的任务是否全部执行完成。请以JSON格式返回，包含：result字段（值为：已完成、未完成或未找到）和reason字段（说明具体原因）。例如：{\"result\": \"已完成\", \"reason\": \"所有任务都已标记为完成\"} 或 {\"result\": \"未完成\", \"reason\": \"还有3个任务未完成\"} 或 {\"result\": \"未找到\", \"reason\": \"文件不存在或无法找到\"}。只返回JSON格式，不要返回其他内容。";
}

/**
 * 获取 deploy 命令提示词
 * 用于执行部署命令并等待服务启动
 * @returns deploy 命令提示词
 */
export function getDeployCommand(): string {
    return `执行 make sandbox 命令，确保服务完全启动并可访问。

## 执行步骤

1. **执行部署命令**
   - 先执行 make sandbox-stop 停止可能存在的服务（无论服务是否在运行都执行此命令）
   - 等待停止命令执行完成
   - 然后执行 make sandbox 启动服务
   - 如果遇到任何部署错误，必须分析并解决问题，重新执行直到成功
   - 不要在遇到错误时停止，必须想办法解决问题

2. **等待服务完全启动**
   需要分析日志输出，判断服务是否真正启动完成：
   - 观察日志输出，识别服务启动的关键标志（如 dev server ready、服务启动成功等信息）
   - 不要仅看到容器启动的消息就认为服务完成，需要等到实际的应用服务器启动并输出访问地址
   - 判断标准：当日志中出现明确的访问地址（如 Local、Network 等）且服务器显示 ready 状态时，才算真正启动完成
   - 如果日志输出停止且没有错误信息，可以尝试访问服务地址验证是否可用
   
   注意：不同项目的日志格式不同，需要根据实际输出灵活判断，关键是确保应用服务器已完全启动并可以对外提供服务。

3. **提取访问地址**
   分析 make sandbox 的输出和项目结构，识别所有可用的服务：
   - 查看日志中出现的访问地址（如 Local、Network 等）
   - 根据项目目录结构识别前端应用（如 backend、shadow、app、pc 等）
   - 提取每个服务的实际访问地址
   - 记录服务启动状态（运行中/未启动/启动失败）
   - 只记录实际存在的服务，不要添加项目中不存在的服务

4. **生成部署文档**
   在 docs/deploy 目录下创建 deploy.md 文件，动态生成内容：
   
   - 包含部署时间、环境信息
   - 访问地址部分：列出实际识别到的所有服务及其地址
   - 对于未启动或启动失败的服务：
     * 明确标注状态（如：未启动、目录不存在、启动失败等）
     * **启动失败的服务必须记录错误日志**（最后 20-30 行关键日志）
     * 日志信息用代码块包裹，放在该服务状态说明之后
     * 这些日志信息将用于下次循环时分析和修复问题
   - 只包含实际存在的服务，不要添加项目中不存在的服务
   
   格式示例：
   \`\`\`markdown
   # 部署信息
   
   部署时间: [当前时间]
   环境: Sandbox
   
   ## 访问地址
   
   - [服务名称]: [访问地址] [状态标注]
   
   ## 服务状态
   
   详细说明每个服务的运行状态
   
   ### [失败服务名称] ❌ 启动失败
   
   错误日志：
   \\\`\\\`\\\`
   [最后 20-30 行错误日志内容]
   \\\`\\\`\\\`
   \`\`\`

## 重要提醒

- 遇到部署问题时，必须分析错误原因并解决，不要直接放弃
- 必须等到 vite dev server 完全启动（看到 "ready in XXXms."）才能继续
- 确保提取的地址信息完整准确
- deploy.md 文件必须创建成功`;
}

/**
 * 获取 deploy check 命令提示词
 * 用于检查部署是否成功，并验证服务可访问性
 * @returns deploy check 命令提示词
 */
export function getDeployCheckCommand(): string {
    return `检查部署状态和服务可访问性。

## 检查项目

1. **检查 deploy.md 文件**
   - 查找 docs/deploy/deploy.md 文件是否存在
   - 文件内容是否包含完整的访问地址信息

2. **验证服务可访问性**
   - 从 deploy.md 的"访问地址"部分动态读取所有服务地址
   - 识别每个服务的状态标注（如：运行中、未启动、启动失败、目录不存在等）
   - **关键判断逻辑（必须严格遵守）**：
     * "目录不存在"的服务 → 不参与检查（项目本身不包含该服务，属于正常情况）
     * "未启动"的服务 → **直接判定为未完成**（项目应该有但没启动）
     * "启动失败"的服务 → **直接判定为未完成**（项目应该有但启动出错）
     * "运行中"的服务 → 需要访问测试验证
   - 对"运行中"的服务使用 curl 验证访问，检查返回状态码：
     * 2xx 状态码 → 成功
     * 3xx 重定向 → 需要说明（一般视为成功）
     * **4xx、5xx 状态码 → 失败**（特别注意：502 Bad Gateway、503 Service Unavailable、504 Gateway Timeout 都是失败）
     * Connection refused/timeout → 失败
   - **重要强调**：502 Bad Gateway 是后端服务未正常启动的常见表现，必须判定为失败，绝对不能返回"已完成"
   - 每个地址都需要实际访问验证

3. **返回检查结果**
   以 JSON 格式返回，包含：
   - result 字段：
     * "已完成" - 仅当满足以下所有条件：
       1. 没有任何"启动失败"的服务
       2. 没有任何"未启动"的服务（"目录不存在"除外）
       3. 所有"运行中"的服务都可正常访问（返回 2xx 状态码）
     * "未完成" - 以下任一情况：
       1. 存在"启动失败"的服务
       2. 存在"未启动"的服务
       3. 任何"运行中"的服务返回非 2xx 状态码（如 500、502、503、504 等）
       4. 任何服务无法访问（Connection refused/timeout）
     * "未找到" - deploy.md 文件不存在
   - reason 字段：说明具体原因和检查结果
   - details 字段：包含每个服务的访问测试结果（状态码、响应信息等）
   
   **判断标准（必须严格执行）：**
   - "启动失败"或"未启动"的服务必须导致结果为"未完成"
   - 502、503、504 等网关错误必须判定为"未完成"
   - 只有"目录不存在"的服务才可以忽略不检查
   - 只要有任何一个服务失败或未正常运行，整体结果就是"未完成"

## 示例返回

成功（所有服务正常运行且可访问）：
\`\`\`json
{
  "result": "已完成",
  "reason": "deploy.md 已创建，所有服务均正常运行且可访问",
  "details": {
    "统一入口": "✅ 200 OK",
    "后端API": "✅ 200 OK",
    "管理后台": "✅ 200 OK"
  }
}
\`\`\`

失败（服务返回 502 等错误状态码，必须判定为未完成）：
\`\`\`json
{
  "result": "未完成",
  "reason": "后端API返回502错误，服务未正常运行",
  "details": {
    "统一入口": "✅ 200 OK",
    "后端API": "❌ 502 Bad Gateway - 服务未正常启动",
    "管理后台": "✅ 200 OK"
  }
}
\`\`\`

失败（存在启动失败或未启动的服务，必须判定为未完成）：
\`\`\`json
{
  "result": "未完成",
  "reason": "存在启动失败的服务：后端API",
  "details": {
    "统一入口": "✅ 200 OK",
    "后端API": "❌ 启动失败（查看 deploy.md 中的错误日志）",
    "管理后台": "✅ 200 OK"
  }
}
\`\`\`

未找到：
\`\`\`json
{
  "result": "未找到",
  "reason": "deploy.md 文件不存在"
}
\`\`\`

**注意**：502 Bad Gateway 是后端服务未正常启动的典型表现，绝对不能返回"已完成"。

只返回 JSON 格式，不要返回其他内容。`;
}

/**
 * 获取代码改进命令提示词
 */
export function getImproveCommand(): string {
    return `请执行以下代码改进任务：

1. **读取改进文件**
   - 文件路径: docs/code/ImproveCode.md
   - 该文件包含 QA 测试报告、Bug 清单和用户改进建议

2. **分析问题**
   - 仔细阅读文件中的所有问题描述
   - 识别问题的根本原因和优先级
   - 理解用户的改进建议

3. **执行改进**
   - 修复所有发现的 Bug（功能缺陷）
   - 优化代码性能（响应速度、资源使用）
   - 改进代码质量（可读性、可维护性）
   - 提升用户体验（交互、界面、反馈）
   - 确保符合最佳实践和编码规范

4. **问题标记机制（重要）**
   - 每解决一个问题后，在 ImproveCode.md 中对应问题后添加 ✅ 已解决 标记
   - 例如：
     \`\`\`markdown
     ### Bug 1: 登录失败处理不正确 ✅ 已解决
     - 已修复错误处理逻辑
     \`\`\`
   - 这样避免下次循环重复执行已解决的问题

5. **完成确认**
   - 确保所有改进都已成功实现
   - 验证改进没有引入新问题
   - 保持代码风格一致性
   - **只有当所有问题都标记为 ✅ 已解决 后，才删除 docs/code/ImproveCode.md 文件**

**重要提示**：
- cursor-agent -p 是无状态的，每次执行都是全新上下文
- 必须通过标记已解决问题来避免重复执行
- 如果所有问题都已解决 → 删除 ImproveCode.md 文件
- 如果还有未解决问题 → 保留 ImproveCode.md 文件，系统会再次执行改进

请开始执行全面的代码改进任务。`;
}

export default {
    CODE_SYSTEM_PROMPT,
    CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT,
    CODE_REVIEW_SYSTEM_PROMPT,
    buildCodePrompt,
    buildCodePromptWithStandardDocs,
    buildTaskDescriptionPrompt,
    buildCodeCompletenessCheckPrompt,
    buildCodeCompletionPrompt,
    buildCodeReviewPrompt,
    buildCursorCLICodeReviewPrompt,
    buildOpenSpecApplyPrompt,
    getApplyCommand,
    getCheckCommand,
    getDeployCommand,
    getDeployCheckCommand,
    getImproveCommand,
    checkCodeCompleteness,
    checkFrontendBackendCompleteness,
    extractFileListFromDesign,
    parseCodeFiles,
};
