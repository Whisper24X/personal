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
    checkCodeCompleteness,
    checkFrontendBackendCompleteness,
    extractFileListFromDesign,
    parseCodeFiles,
};
