/**
 * Section Parser
 * 用于解析文档中的章节信息
 */

export interface Section {
  number: number;
  title: string;
  content?: string;
  startLine?: number;
  endLine?: number;
}

/**
 * 从 Markdown 内容中解析章节
 */
export function parseSectionsFromContent(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split('\n');
  
  let currentSection: Section | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 匹配章节标题：## 数字. 标题
    const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (match) {
      // 保存上一个章节
      if (currentSection) {
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }
      
      // 开始新章节
      currentSection = {
        number: parseInt(match[1]),
        title: match[2].trim(),
        startLine: i,
      };
    } else if (currentSection && line.trim() !== '') {
      // 累积章节内容
      if (!currentSection.content) {
        currentSection.content = '';
      }
      currentSection.content += line + '\n';
    }
  }
  
  // 保存最后一个章节
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * 从章节列表中提取特定章节的内容
 * @returns 章节内容，如果找不到章节则返回 null，如果章节存在但内容为空则返回空字符串
 */
export function extractSectionContent(content: string, sectionNumber: number): string | null {
  const sections = parseSectionsFromContent(content);
  const section = sections.find(s => s.number === sectionNumber);
  if (!section) {
    return null; // 章节不存在
  }
  // 章节存在，返回内容（可能为空字符串）
  return section.content?.trim() ?? '';
}

/**
 * 获取文档中所有章节的编号列表
 */
export function getAvailableSectionNumbers(content: string): number[] {
  const sections = parseSectionsFromContent(content);
  return sections.map(s => s.number).sort((a, b) => a - b);
}

/**
 * 替换文档中的特定章节内容
 */
export function replaceSectionContent(
  content: string,
  sectionNumber: number,
  newContent: string
): string {
  const sections = parseSectionsFromContent(content);
  const section = sections.find(s => s.number === sectionNumber);
  
  if (!section || section.startLine === undefined) {
    // 如果找不到章节，返回原内容
    return content;
  }
  
  const lines = content.split('\n');
  const beforeLines = lines.slice(0, section.startLine + 1);
  const afterLines = section.endLine !== undefined 
    ? lines.slice(section.endLine + 1)
    : [];
  
  // 构建新章节内容
  const sectionTitle = `## ${section.number}. ${section.title}`;
  const newSectionLines = [sectionTitle, '', newContent.trim()];
  
  return [...beforeLines, ...newSectionLines, ...afterLines].join('\n');
}


