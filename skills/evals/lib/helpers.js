/**
 * Helpers for PRD Evaluation
 * 
 * Provides Cursor CLI calling and HTML report generation
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Load environment variables from .env file
 */
function loadEnvConfig() {
  try {
    const envPath = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(envPath)) {
      const dotenv = require('dotenv');
      dotenv.config({ path: envPath });
    }
  } catch (e) {
    console.warn('Warning: Could not load .env file:', e.message);
  }
}

/**
 * Call Cursor CLI (cursor-agent)
 * @param {string} prompt - The prompt to send to Cursor CLI
 * @param {string} workDir - Working directory for execution
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} - Cursor CLI response
 */
async function callCursorCLI(prompt, workDir, options = {}) {
  loadEnvConfig();

  const apiKey = process.env.CURSOR_API_KEY;
  const model = process.env.CURSOR_CLI_MODEL || 'composer-1';
  const timeout = options.timeout || 300000; // 5 minutes default
  const maxRetries = options.maxRetries || 3;

  if (!apiKey) {
    throw new Error('CURSOR_API_KEY not found in environment variables. Please configure .env file.');
  }

  console.log(`🤖 Using Cursor CLI (model: ${model})...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Escape prompt for shell
      const escapedPrompt = prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      
      // Build cursor-agent command
      const command = `cursor-agent --model ${model} --api-key "${apiKey}" --print "${escapedPrompt}"`;

      console.log(`📡 Executing cursor-agent in ${workDir}...`);

      // Execute command
      const output = execSync(command, {
        cwd: workDir,
        timeout: timeout,
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        stdio: ['pipe', 'pipe', 'pipe']
      });

      console.log(`✅ Cursor CLI execution completed (${output.length} characters)`);
      return output.trim();

    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (error.stderr) {
        console.error(`   stderr: ${error.stderr.toString().substring(0, 500)}`);
      }

      if (attempt === maxRetries) {
        throw new Error(`Cursor CLI call failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/**
 * Parse markdown evaluation to structured data
 * @param {string} evaluation - Markdown evaluation result from LLM
 * @returns {object} - Structured evaluation data
 */
function parseEvaluation(evaluation) {
  const sections = {
    summary: '',
    strengths: [],
    issues: [],
    recommendations: [],
    accuracy: {
      fieldIdentification: { rate: '', description: '' },
      businessRules: { rate: '', description: '' },
      processIdentification: { rate: '', description: '' },
      rolePermissions: { rate: '', description: '' }
    },
    conclusion: {
      promotionReady: '',
      scalable: '',
      risks: [],
      suggestions: []
    },
    difficulty: {
      level: '',
      dimensions: [],
      reasoning: '',
      risks: []
    }
  };

  // Extract sections using regex
  const summaryMatch = evaluation.match(/##\s*Summary[^\n]*\n([\s\S]*?)(?=##\s*需求难度评级|$)/i);
  if (summaryMatch) {
    sections.summary = summaryMatch[1].trim();
  }

  // Extract difficulty rating (now comes after Summary)
  const difficultyMatch = evaluation.match(/##\s*需求难度评级[:：]\s*(L[1-4])/i);
  if (difficultyMatch) {
    sections.difficulty.level = difficultyMatch[1];
  }

  // Extract accuracy assessment (now comes after difficulty)
  const accuracyMatch = evaluation.match(/##\s*准确率评估[^\n]*\n([\s\S]*?)(?=##\s*评估结论|$)/i);
  if (accuracyMatch) {
    const tableContent = accuracyMatch[1];
    // Parse table rows (skip header rows)
    const rows = tableContent.split('\n').filter(line => 
      line.trim().startsWith('|') && !line.includes('---') && !line.includes('评估维度')
    );
    
    rows.forEach(row => {
      const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
      if (cells.length >= 3) {
        const dimension = cells[0];
        const rate = cells[1];
        const description = cells[2];
        
        if (dimension.includes('字段识别')) {
          sections.accuracy.fieldIdentification = { rate, description };
        } else if (dimension.includes('业务规则')) {
          sections.accuracy.businessRules = { rate, description };
        } else if (dimension.includes('流程识别')) {
          sections.accuracy.processIdentification = { rate, description };
        } else if (dimension.includes('角色权限')) {
          sections.accuracy.rolePermissions = { rate, description };
        }
      }
    });
  }

  // Extract conclusion (now comes after accuracy assessment)
  const conclusionMatch = evaluation.match(/##\s*评估结论[^\n]*\n([\s\S]*?)(?=##\s*Strengths|$)/i);
  if (conclusionMatch) {
    const conclusionText = conclusionMatch[1];
    
    // Extract promotion readiness
    const promotionMatch = conclusionText.match(/[-*]\s*\*?\*?是否达到推广标准\*?\*?[:：]\s*(.+)/i);
    if (promotionMatch) {
      sections.conclusion.promotionReady = promotionMatch[1].trim();
    }
    
    // Extract scalability
    const scalableMatch = conclusionText.match(/[-*]\s*\*?\*?是否可规模化使用\*?\*?[:：]\s*(.+)/i);
    if (scalableMatch) {
      sections.conclusion.scalable = scalableMatch[1].trim();
    }
    
    // Extract risks
    const risksMatch = conclusionText.match(/[-*]\s*\*?\*?风险点\*?\*?[:：]\s*([\s\S]*?)(?=[-*]\s*\*?\*?优化建议|$)/i);
    if (risksMatch) {
      const riskItems = risksMatch[1].match(/^[\s]*[-*]\s*(.+)$/gm);
      if (riskItems) {
        sections.conclusion.risks = riskItems.map(item => item.replace(/^[\s]*[-*]\s*/, '').trim());
      }
    }
    
    // Extract suggestions
    const suggestionsMatch = conclusionText.match(/[-*]\s*\*?\*?优化建议\*?\*?[:：]\s*([\s\S]*?)$/i);
    if (suggestionsMatch) {
      const suggestionItems = suggestionsMatch[1].match(/^[\s]*[-*]\s*(.+)$/gm);
      if (suggestionItems) {
        sections.conclusion.suggestions = suggestionItems.map(item => item.replace(/^[\s]*[-*]\s*/, '').trim());
      }
    }
  }

  // Extract Strengths (now comes after conclusion)
  const strengthsMatch = evaluation.match(/##\s*Strengths[^\n]*\n([\s\S]*?)(?=##\s*Issues|$)/i);
  if (strengthsMatch) {
    const items = strengthsMatch[1].match(/^[\s]*[-*]\s*(.+)$/gm);
    if (items) {
      sections.strengths = items.map(item => item.replace(/^[\s]*[-*]\s*/, '').trim());
    }
  }

  // Extract Issues (now comes after Strengths)
  const issuesMatch = evaluation.match(/##\s*Issues[^\n]*\n([\s\S]*?)(?=##\s*Recommendations|$)/i);
  if (issuesMatch) {
    const items = issuesMatch[1].match(/^[\s]*[-*]\s*(.+)$/gm);
    if (items) {
      sections.issues = items.map(item => {
        const text = item.replace(/^[\s]*[-*]\s*/, '').trim();
        const priorityMatch = text.match(/\[?(P[0-3])\]?/i);
        return {
          priority: priorityMatch ? priorityMatch[1].toUpperCase() : 'P2',
          text: text
        };
      });
    }
  }

  // Extract Recommendations (now comes after Issues)
  const recommendationsMatch = evaluation.match(/##\s*Recommendations[^\n]*\n([\s\S]*?)$/i);
  if (recommendationsMatch) {
    const items = recommendationsMatch[1].match(/^[\s]*[-*]\s*(.+)$/gm);
    if (items) {
      sections.recommendations = items.map(item => item.replace(/^[\s]*[-*]\s*/, '').trim());
    }
  }

  return sections;
}

/**
 * Get CSS class for accuracy rate
 * @param {string} rate - Accuracy rate (e.g., "85%")
 * @returns {string} - CSS class name
 */
function getAccuracyClass(rate) {
  if (!rate) return '';
  const numRate = parseInt(rate);
  if (numRate >= 80) return 'rate-high';
  if (numRate >= 70) return 'rate-medium';
  return 'rate-low';
}

/**
 * Generate HTML report from evaluation data
 * @param {string} evaluation - Raw evaluation text from LLM
 * @param {string} prdPath - Path to original PRD file
 * @returns {string} - HTML report
 */
function generateHTMLReport(evaluation, prdPath) {
  const data = parseEvaluation(evaluation);
  const timestamp = new Date().toLocaleString('zh-CN');
  const prdFilename = path.basename(prdPath);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PRD 评估报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    h1 {
      color: #2563eb;
      margin-bottom: 8px;
      font-size: 2em;
      font-weight: 700;
    }
    
    .meta {
      color: #64748b;
      margin-bottom: 32px;
      padding: 16px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.95em;
    }
    
    .meta p {
      margin: 4px 0;
    }
    
    h2 {
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
      padding: 12px 0;
      font-size: 1.4em;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    section {
      margin-bottom: 24px;
      background: #ffffff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    
    ul {
      list-style: none;
      padding-left: 0;
    }
    
    li {
      padding: 12px 16px;
      margin: 8px 0;
      background: #f8fafc;
      border-left: 3px solid #2563eb;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    
    li:hover {
      background: #f1f5f9;
      transform: translateX(2px);
    }
    
    .issue {
      margin: 10px 0;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid;
      transition: all 0.2s ease;
    }
    
    .issue:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transform: translateX(2px);
    }
    
    .issue.p0 {
      background: #fef2f2;
      border-left-color: #ef4444;
    }
    
    .issue.p1 {
      background: #fff7ed;
      border-left-color: #f97316;
    }
    
    .issue.p2 {
      background: #fefce8;
      border-left-color: #eab308;
    }
    
    .issue.p3 {
      background: #f0fdf4;
      border-left-color: #10b981;
    }
    
    .priority-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8em;
      margin-right: 8px;
      letter-spacing: 0.5px;
    }
    
    .p0 .priority-badge {
      background: #ef4444;
      color: white;
    }
    
    .p1 .priority-badge {
      background: #f97316;
      color: white;
    }
    
    .p2 .priority-badge {
      background: #eab308;
      color: #422006;
    }
    
    .p3 .priority-badge {
      background: #10b981;
      color: white;
    }
    
    .difficulty {
      display: inline-block;
      padding: 12px 24px;
      font-size: 1.5em;
      font-weight: 700;
      border-radius: 8px;
      margin: 10px 0;
    }
    
    .difficulty.l1 {
      background: #dcfce7;
      color: #15803d;
      border: 2px solid #10b981;
    }
    
    .difficulty.l2 {
      background: #fef9c3;
      color: #a16207;
      border: 2px solid #eab308;
    }
    
    .difficulty.l3 {
      background: #fed7aa;
      color: #c2410c;
      border: 2px solid #f97316;
    }
    
    .difficulty.l4 {
      background: #fecaca;
      color: #b91c1c;
      border: 2px solid #ef4444;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      border-radius: 8px;
      overflow: hidden;
    }
    
    th, td {
      padding: 12px 16px;
      text-align: left;
      border: none;
    }
    
    th {
      background: #2563eb;
      color: white;
      font-weight: 600;
      font-size: 0.9em;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    
    tbody tr:hover {
      background: #f1f5f9;
    }
    
    tbody tr:last-child {
      border-bottom: none;
    }
    
    .summary-text {
      background: #dbeafe;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
      margin: 0;
      line-height: 1.7;
    }
    
    .recommendation {
      padding: 16px;
      margin: 10px 0;
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    
    .recommendation:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transform: translateX(2px);
    }
    
    .recommendation strong {
      color: #15803d;
    }
    
    .accuracy-table {
      width: 100%;
      margin: 16px 0;
      border-collapse: collapse;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .accuracy-table th {
      background: #2563eb;
      color: white;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 0.9em;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    
    .accuracy-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .accuracy-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .accuracy-table tbody tr:hover {
      background: #f1f5f9;
    }
    
    .accuracy-rate {
      font-weight: 700;
      font-size: 1.1em;
    }
    
    .rate-high {
      color: #15803d;
    }
    
    .rate-medium {
      color: #a16207;
    }
    
    .rate-low {
      color: #b91c1c;
    }
    
    .conclusion-card {
      background: #f8fafc;
      padding: 24px;
      border-radius: 8px;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    
    .conclusion-item {
      background: white;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    
    .conclusion-item strong {
      color: #0f172a;
      display: block;
      margin-bottom: 8px;
      font-size: 0.95em;
    }
    
    .conclusion-list {
      margin-left: 0;
      padding-left: 20px;
    }
    
    .conclusion-list li {
      margin: 6px 0;
      padding: 8px 12px;
      background: #f8fafc;
      border-left: 2px solid #cbd5e1;
      list-style: none;
    }
    
    .status-yes {
      color: #15803d;
      font-weight: 600;
    }
    
    .status-no {
      color: #b91c1c;
      font-weight: 600;
    }
    
    pre {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.9em;
      line-height: 1.5;
      border: 1px solid #e2e8f0;
    }
    
    /* 可折叠样式 */
    .collapsible {
      margin-bottom: 24px;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: all 0.3s ease;
    }
    
    .collapsible-header {
      cursor: pointer;
      user-select: none;
      padding: 16px 20px;
      margin: 0;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      transition: all 0.2s ease;
    }
    
    .collapsible-header:hover {
      background: #f1f5f9;
    }
    
    .collapsible-header:active {
      background: #e2e8f0;
    }
    
    .collapse-icon {
      display: inline-block;
      margin-right: 8px;
      transition: transform 0.3s ease;
      font-size: 0.8em;
      color: #64748b;
    }
    
    .collapsible[data-collapsed="true"] .collapse-icon {
      transform: rotate(-90deg);
    }
    
    .item-count {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      background: #e2e8f0;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
      color: #475569;
    }
    
    .collapsible-content {
      padding: 20px;
      overflow: hidden;
      transition: max-height 0.3s ease, opacity 0.3s ease;
      will-change: max-height;
    }
    
    .collapsible[data-collapsed="true"] .collapsible-content {
      max-height: 0 !important;
      padding-top: 0;
      padding-bottom: 0;
      opacity: 0;
    }
    
    /* 响应式设计 */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      .container {
        padding: 24px;
      }
      
      h1 {
        font-size: 1.6em;
      }
      
      h2 {
        font-size: 1.2em;
      }
      
      .conclusion-card {
        grid-template-columns: 1fr;
      }
      
      table {
        font-size: 0.9em;
      }
      
      th, td {
        padding: 8px 12px;
      }
    }
    
    @media print {
      body {
        background: white;
      }
      
      .container {
        box-shadow: none;
      }
      
      .collapsible-content {
        max-height: none !important;
        opacity: 1 !important;
        padding: 20px !important;
      }
      
      .collapsible[data-collapsed="true"] .collapsible-content {
        max-height: none !important;
        opacity: 1 !important;
      }
      
      .collapse-icon {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 PRD 评估报告</h1>
    <div class="meta">
      <p><strong>评估文件：</strong>${prdFilename}</p>
      <p><strong>评估时间：</strong>${timestamp}</p>
      <p><strong>评估工具：</strong>evals-skill v1.0.0</p>
    </div>

    <section>
      <h2>📝 Summary（摘要）</h2>
      <div class="summary-text">
        ${data.summary || '暂无摘要'}
      </div>
    </section>

    <section>
      <h2>📊 需求难度评级</h2>
      ${data.difficulty.level ? `
      <div>
        <span class="difficulty ${data.difficulty.level.toLowerCase()}">${data.difficulty.level}</span>
      </div>
      ` : '<p>暂无难度评级</p>'}
    </section>

    <section>
      <h2>🎯 准确率评估</h2>
      <table class="accuracy-table">
        <thead>
          <tr>
            <th>评估维度</th>
            <th>准确率</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>字段识别</td>
            <td class="accuracy-rate ${getAccuracyClass(data.accuracy.fieldIdentification.rate)}">${data.accuracy.fieldIdentification.rate || 'N/A'}</td>
            <td>${data.accuracy.fieldIdentification.description || '暂无说明'}</td>
          </tr>
          <tr>
            <td>业务规则</td>
            <td class="accuracy-rate ${getAccuracyClass(data.accuracy.businessRules.rate)}">${data.accuracy.businessRules.rate || 'N/A'}</td>
            <td>${data.accuracy.businessRules.description || '暂无说明'}</td>
          </tr>
          <tr>
            <td>流程识别</td>
            <td class="accuracy-rate ${getAccuracyClass(data.accuracy.processIdentification.rate)}">${data.accuracy.processIdentification.rate || 'N/A'}</td>
            <td>${data.accuracy.processIdentification.description || '暂无说明'}</td>
          </tr>
          <tr>
            <td>角色权限</td>
            <td class="accuracy-rate ${getAccuracyClass(data.accuracy.rolePermissions.rate)}">${data.accuracy.rolePermissions.rate || 'N/A'}</td>
            <td>${data.accuracy.rolePermissions.description || '暂无说明'}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>📋 评估结论</h2>
      <div class="conclusion-card">
        <div class="conclusion-item">
          <strong>是否达到推广标准：</strong>
          <span class="${data.conclusion.promotionReady.toLowerCase().includes('是') ? 'status-yes' : 'status-no'}">
            ${data.conclusion.promotionReady || '暂无评估'}
          </span>
        </div>
        
        <div class="conclusion-item">
          <strong>是否可规模化使用：</strong>
          <span class="${data.conclusion.scalable.toLowerCase().includes('是') ? 'status-yes' : 'status-no'}">
            ${data.conclusion.scalable || '暂无评估'}
          </span>
        </div>
        
        <div class="conclusion-item">
          <strong>风险点：</strong>
          ${data.conclusion.risks.length > 0 ? `
          <ul class="conclusion-list">
            ${data.conclusion.risks.map(risk => `<li>${risk}</li>`).join('\n            ')}
          </ul>
          ` : '<p>暂无风险点</p>'}
        </div>
        
        <div class="conclusion-item">
          <strong>优化建议：</strong>
          ${data.conclusion.suggestions.length > 0 ? `
          <ul class="conclusion-list">
            ${data.conclusion.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('\n            ')}
          </ul>
          ` : '<p>暂无优化建议</p>'}
        </div>
      </div>
    </section>

    <section class="collapsible" data-collapsed="false">
      <h2 class="collapsible-header">
        <span class="collapse-icon">▼</span>
        ✅ Strengths（优点）
        <span class="item-count">${data.strengths.length}项</span>
      </h2>
      <div class="collapsible-content">
        <ul>
          ${data.strengths.map(item => `<li>${item}</li>`).join('\n          ')}
        </ul>
      </div>
    </section>

    <section class="collapsible" data-collapsed="true">
      <h2 class="collapsible-header">
        <span class="collapse-icon">▼</span>
        ⚠️ Issues（问题）
        <span class="item-count">${data.issues.length}项</span>
      </h2>
      <div class="collapsible-content">
        ${data.issues.map(issue => `
        <div class="issue ${issue.priority.toLowerCase()}">
          <span class="priority-badge">${issue.priority}</span>
          ${issue.text}
        </div>
        `).join('\n        ')}
        ${data.issues.length === 0 ? '<p>✨ 未发现明显问题</p>' : ''}
      </div>
    </section>

    <section class="collapsible" data-collapsed="true">
      <h2 class="collapsible-header">
        <span class="collapse-icon">▼</span>
        💡 Recommendations（建议）
        <span class="item-count">${data.recommendations.length}项</span>
      </h2>
      <div class="collapsible-content">
        ${data.recommendations.map(rec => `
        <div class="recommendation">
          ${rec}
        </div>
        `).join('\n        ')}
      </div>
    </section>

    <section class="collapsible" data-collapsed="true">
      <h2 class="collapsible-header">
        <span class="collapse-icon">▼</span>
        📄 完整评估内容
      </h2>
      <div class="collapsible-content">
        <pre>${evaluation}</pre>
      </div>
    </section>
  </div>

  <script>
    // 初始化所有可折叠元素的点击事件
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', function() {
        const section = this.closest('.collapsible');
        const content = section.querySelector('.collapsible-content');
        const icon = this.querySelector('.collapse-icon');
        const isCollapsed = section.dataset.collapsed === 'true';
        
        // 切换状态
        section.dataset.collapsed = isCollapsed ? 'false' : 'true';
        
        // 更新图标旋转
        if (isCollapsed) {
          icon.style.transform = 'rotate(0deg)';
          content.style.maxHeight = content.scrollHeight + 'px';
          content.style.opacity = '1';
        } else {
          icon.style.transform = 'rotate(-90deg)';
          content.style.maxHeight = '0';
          content.style.opacity = '0';
        }
      });
      
      // 添加键盘支持
      header.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
      
      // 添加可访问性属性
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
    });
    
    // 初始化默认状态
    document.querySelectorAll('.collapsible').forEach(section => {
      const content = section.querySelector('.collapsible-content');
      const icon = section.querySelector('.collapse-icon');
      const isCollapsed = section.dataset.collapsed === 'true';
      const header = section.querySelector('.collapsible-header');
      
      // 设置ARIA属性
      header.setAttribute('aria-expanded', !isCollapsed);
      
      if (isCollapsed) {
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        icon.style.transform = 'rotate(-90deg)';
      } else {
        // 使用 requestAnimationFrame 确保 DOM 渲染完成后再计算高度
        requestAnimationFrame(() => {
          content.style.maxHeight = content.scrollHeight + 'px';
          content.style.opacity = '1';
        });
      }
    });
    
    // 窗口大小改变时重新计算展开内容的高度
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        document.querySelectorAll('.collapsible[data-collapsed="false"] .collapsible-content').forEach(content => {
          content.style.maxHeight = content.scrollHeight + 'px';
        });
      }, 250);
    });
  </script>
</body>
</html>`;

  return html;
}

module.exports = {
  callCursorCLI,
  generateHTMLReport,
  parseEvaluation
};
