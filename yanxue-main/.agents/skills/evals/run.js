#!/usr/bin/env node
/**
 * PRD Evaluation Executor
 * 
 * Evaluates PRD documents using LLM and generates HTML reports
 * 
 * Usage:
 *   node run.js <PRD_FILE_PATH> [OUTPUT_DIRECTORY]
 * 
 * Examples:
 *   node run.js ./PRD.md
 *   node run.js ./PRD.md ./output
 */

const fs = require('fs');
const path = require('path');
const { callCursorCLI, generateHTMLReport } = require('./lib/helpers');

// Change to skill directory for proper module resolution
process.chdir(__dirname);

/**
 * Display usage information
 */
function showHelp() {
  console.log(`
📊 PRD Evaluation Executor

Usage:
  node run.js <PRD_FILE_PATH> [OUTPUT_DIRECTORY]

Arguments:
  PRD_FILE_PATH      Path to the PRD markdown file (required)
  OUTPUT_DIRECTORY   Directory to save the HTML report (optional, defaults to PRD's directory)

Examples:
  node run.js ./PRD.md
  node run.js ./PRD.md ./reports
  node run.js /path/to/PRD.md /path/to/output

Environment Variables:
  CURSOR_API_KEY     Cursor API key (required)
  CURSOR_CLI_MODEL   Cursor model (default: composer-1)

Output:
  PRD-evaluation-report.html will be saved to the specified output directory
`);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const prdPath = path.resolve(args[0]);
  let outputDir = args[1] ? path.resolve(args[1]) : path.dirname(prdPath);

  return { prdPath, outputDir };
}

/**
 * Validate inputs
 */
function validateInputs(prdPath, outputDir) {
  // Check if PRD file exists
  if (!fs.existsSync(prdPath)) {
    console.error(`❌ Error: PRD file not found: ${prdPath}`);
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    console.log(`📁 Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Build evaluation prompt
 */
function buildPrompt(prdContent, skillContent) {
  return `你是一个专业的 PRD 评审专家。请严格按照以下规范对 PRD 进行全面评审。

**重要提示**：
1. 请直接输出评审内容，不要生成文件或提示文件已保存
2. 必须严格按照以下格式输出（使用 Markdown 格式）
3. 每个部分都必须有实质内容，不能为空

**评审规范**：
${skillContent}

**输出格式要求（必须严格遵守）**：

## Summary（摘要）
[简要总结文档目的、类型、覆盖范围与核心内容，3-5句话]

## 需求难度评级：L3

### 评估维度

| 维度               | 等级 | 说明                                             |
| ------------------ | ---- | ------------------------------------------------ |
| 功能点数           | L3   | [具体说明]                                       |
| 技术复杂度         | L3   | [具体说明]                                       |
| 数据复杂度         | L2   | [具体说明]                                       |
| 测试验证复杂度     | L3   | [具体说明]                                       |
| 依赖与协作复杂度   | L3   | [具体说明]                                       |
| 交付风险           | L2   | [具体说明]                                       |

### 综合评级理由
[说明为什么是这个难度等级，预估工期]

### 关键风险点
- [风险点1]
- [风险点2]

## 准确率评估

| 评估维度   | 准确率 | 说明                                             |
| ---------- | ------ | ------------------------------------------------ |
| 字段识别   | XX%    | [具体说明字段定义的完整性与准确性]               |
| 业务规则   | XX%    | [具体说明业务规则的清晰度与正确性]               |
| 流程识别   | XX%    | [具体说明业务流程的完整性与准确性]               |
| 角色权限   | XX%    | [具体说明角色权限定义的明确性与正确性]           |

## 评估结论

- **是否达到推广标准**：是/否 + [理由：基于准确率与问题严重性]
- **是否可规模化使用**：是/否 + [理由：基于架构可扩展性、技术选型、依赖关系]
- **风险点**：
  - [风险点1：技术风险/业务风险/交付风险]
  - [风险点2]
  - [风险点3]
- **优化建议**：
  - [建议1：高优先级改进建议]
  - [建议2]
  - [建议3]

## Strengths（优点）
- [优点1：具体描述]
- [优点2：具体描述]
- [优点3：具体描述]

## Issues（问题）
- **[P0] 问题标题**：具体描述问题，指出位置，说明影响
- **[P1] 问题标题**：具体描述问题，指出位置，说明影响
- **[P2] 问题标题**：具体描述问题，指出位置，说明影响

## Recommendations（建议）
- **建议1**：具体可操作的建议，对应上面的某个问题
- **建议2**：具体可操作的建议，对应上面的某个问题
- **建议3**：具体可操作的建议，对应上面的某个问题

---

待评审的 PRD 文档：

\`\`\`markdown
${prdContent}
\`\`\`

请现在开始评审，直接输出评审内容（不要说"已保存到文件"之类的话）。`;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 PRD Evaluation Executor Started\n');

  try {
    // Parse arguments
    const { prdPath, outputDir } = parseArgs();
    
    console.log(`📄 PRD File: ${prdPath}`);
    console.log(`📁 Output Directory: ${outputDir}\n`);

    // Validate inputs
    validateInputs(prdPath, outputDir);

    // Read PRD file
    console.log('📖 Reading PRD file...');
    const prdContent = fs.readFileSync(prdPath, 'utf8');
    console.log(`✅ PRD loaded (${prdContent.length} characters)\n`);

    // Read SKILL.md
    console.log('📚 Loading evaluation guidelines...');
    const skillPath = path.join(__dirname, 'SKILL.md');
    const skillContent = fs.readFileSync(skillPath, 'utf8');
    console.log('✅ Guidelines loaded\n');

    // Build prompt
    console.log('🔧 Building evaluation prompt...');
    const prompt = buildPrompt(prdContent, skillContent);
    console.log('✅ Prompt ready\n');

    // Call Cursor CLI
    console.log('🤖 Calling Cursor CLI for evaluation...');
    console.log('⏳ This may take a few minutes...\n');
    const evaluation = await callCursorCLI(prompt, outputDir);
    console.log(`✅ Evaluation completed (${evaluation.length} characters)\n`);

    // Generate HTML report
    console.log('📝 Generating HTML report...');
    const html = generateHTMLReport(evaluation, prdPath);
    console.log('✅ HTML report generated\n');

    // Save report
    const outputPath = path.join(outputDir, 'PRD-evaluation-report.html');
    console.log(`💾 Saving report to: ${outputPath}`);
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log('✅ Report saved successfully\n');

    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ PRD Evaluation Completed Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Report Location: ${outputPath}`);
    console.log(`\n💡 Open the HTML file in your browser to view the detailed evaluation report.`);
    console.log('');

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Evaluation Failed');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`\nError: ${error.message}\n`);
    
    if (error.message.includes('API_KEY not found')) {
      console.error('💡 Tip: Please configure your .env file with the required API key:');
      console.error('   - CURSOR_API_KEY (for Cursor CLI)\n');
    }
    
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
