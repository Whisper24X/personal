/**
 * 解析 TEST.md 中每个 #### TC-* 小节属性表里的「类型」列（首列为「类型」的行，排除「元素|类型|参数」表头）。
 * @param {string} text full TEST.md
 * @returns {{ id: string, type: string }[]}
 */
function extractOrderedCases(text) {
  const re = /^####\s+(TC-[FEB]-\d+)/gm;
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
    out.push({ id: headers[i].id, type: parseTypeFromCaseSection(chunk) });
  }
  return out;
}

function parseTypeFromCaseSection(chunk) {
  const lines = chunk.split('\n');
  for (const line of lines) {
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length >= 3 && parts[1] === '类型') {
      return parts[2] || '';
    }
  }
  return '';
}

function filterIdsByType(cases, typeValue) {
  return cases.filter((c) => c.type === typeValue).map((c) => c.id);
}

module.exports = {
  extractOrderedCases,
  parseTypeFromCaseSection,
  filterIdsByType,
};
