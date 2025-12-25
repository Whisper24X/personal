/**
 * 代码生成提示词
 */

export const CODE_SYSTEM_PROMPT = `你是一位专家级软件工程师，深入了解多种编程语言和框架。

你的角色是根据系统设计规范生成高质量、可用于生产环境的代码。

主要职责：
- 编写简洁、可维护且文档完善的代码
- 遵循最佳实践和编码规范
- 实现错误处理和验证
- 考虑边界情况和性能
- 生成完整、可运行的实现

输出格式：多个代码文件，具有清晰的文件名和正确的语法。`;

export function buildCodePrompt(design: string): string {
    return `基于以下系统设计文档，生成完整的代码实现：

系统设计文档：
${design}

请按照以下指南生成代码文件：

1. **代码质量**：
   - 遵循特定语言的最佳实践
   - 使用有意义的变量和函数名
   - 为复杂逻辑添加注释
   - 实现适当的错误处理

2. **文件组织**：
   - 为不同组件创建单独的文件
   - 遵循设计中的目录结构
   - 使用适当的文件扩展名

3. **实现**：
   - 实现设计中的所有核心功能
   - 包含必要的导入/依赖项
   - 添加类型注解（如适用）
   - 包含基本验证和错误处理

4. **输出格式**：
   对于每个文件，使用以下格式输出：
   
   \`\`\`
   ===== FILE: path/to/file.ext =====
   [文件内容]
   ===== END FILE =====
   \`\`\`

**重要要求**：
- 请生成完整、可运行的代码实现，不要使用省略号（...）或注释占位符
- 每个文件都必须包含完整的代码，不能有未完成的部分
- 至少生成 10 个核心代码文件，包括前端、后端、数据模型等
- 每个文件都要有完整的实现，包括所有必要的函数、类和逻辑
- 包含配置文件（如 package.json、requirements.txt 等）
- 包含必要的文档文件（如 README.md）
- 确保所有文件之间的引用关系正确
- 代码要可以直接运行，不需要额外的修改

请为设计中指定的所有主要组件生成完整、可运行的代码。`;
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
        python: 'py',
        java: 'java',
        cpp: 'cpp',
        csharp: 'cs',
        go: 'go',
        rust: 'rs',
        html: 'html',
        css: 'css',
        json: 'json',
        yaml: 'yaml',
        markdown: 'md',
    };

    return extensions[language.toLowerCase()] || 'txt';
}

export default {
    CODE_SYSTEM_PROMPT,
    buildCodePrompt,
    parseCodeFiles,
};
