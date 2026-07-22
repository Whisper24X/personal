/**
 * 解析 TEST.md 中每个 #### TC-* 小节属性表里的元信息（排除「元素|类型|参数」表头）。
 * 支持 `TC-F-001`、`TC-E-001`、`TC-B-001`、`TC-MEM-001` 等通用 `TC-模块-编号` 形式。
 * @param {string} text full TEST.md
 * @returns {{ id: string, type: string, priority: string, scope: string, executable: string, envPrerequisite: string, skipReason: string }[]}
 */
function extractOrderedCases(text) {
  const re = /^####\s+(TC-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)/gm;
  const headers = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    headers.push({ id: m[1], index: m.index });
  }
  const out = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const chunk = text.slice(start, end);
    out.push({ id: headers[i].id, ...parseMetaFromCaseSection(chunk) });
  }
  return out;
}

function parseMetaFromCaseSection(chunk) {
  const fields = parseFieldsFromCaseSection(chunk);
  return {
    type: fields['类型'] || '',
    priority: fields['优先级'] || '',
    scope: fields['覆盖范围'] || '',
    executable: fields['本轮是否执行'] || '',
    envPrerequisite: fields['环境前提'] || '',
    skipReason: fields['不执行原因'] || '',
  };
}

function parseTypeFromCaseSection(chunk) {
  return parseMetaFromCaseSection(chunk).type;
}

function parseFieldsFromCaseSection(chunk) {
  const lines = chunk.split('\n');
  const fields = {};
  for (const line of lines) {
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length >= 3 && parts[1] && parts[2] && parts[1] !== '---') {
      fields[parts[1]] = parts[2] || '';
    }
  }
  return fields;
}

function filterIdsByType(cases, typeValue) {
  return cases.filter((c) => c.type === typeValue).map((c) => c.id);
}

function filterIdsByPriority(cases, priorityValue) {
  return cases.filter((c) => c.priority === priorityValue).map((c) => c.id);
}

function filterExecutableCases(cases) {
  return cases.filter((c) => c.executable === '是');
}

function filterCasesByOptions(cases, options = {}) {
  return cases.filter((c) => {
    if (options.type && c.type !== options.type) return false;
    if (options.priority && c.priority !== options.priority) return false;
    if (options.executableOnly && c.executable !== '是') return false;
    return true;
  });
}

function filterIdsByOptions(cases, options = {}) {
  return filterCasesByOptions(cases, options).map((c) => c.id);
}

module.exports = {
  extractOrderedCases,
  parseMetaFromCaseSection,
  parseTypeFromCaseSection,
  parseFieldsFromCaseSection,
  filterIdsByType,
  filterIdsByPriority,
  filterExecutableCases,
  filterCasesByOptions,
  filterIdsByOptions,
};
