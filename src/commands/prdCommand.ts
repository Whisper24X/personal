import { connectDatabase, disconnectDatabase } from '../db/config.js';
import { prdService } from '../db/services/prdService.js';
import { PRDParser } from '../core/parser/prdParser.js';
import { testCaseService } from '../db/services/testCaseService.js';

/**
 * 从 PRD 文件生成测试用例
 */
export async function generateTestCasesFromPRDFile(
  filePath: string,
  options: {
    prdId?: string;
    saveToDatabase?: boolean;
  }
): Promise<void> {
  try {
    await connectDatabase();

    console.log(`📄 读取 PRD 文件: ${filePath}`);

    // 解析 PRD 文件
    const parser = new PRDParser();
    const prd = await parser.parseFile(filePath);

    // 如果提供了 prdId，使用它
    if (options.prdId) {
      prd.prdId = options.prdId;
    }

    console.log(`✅ PRD 解析完成: ${prd.title}`);

    // 保存 PRD 到数据库
    console.log('💾 保存 PRD 到数据库...');
    const prdRecord = await prdService.upsertPRD(prd);
    console.log(`✅ PRD 已保存: ${prdRecord.prdId}`);

    // 生成测试用例
    console.log('🤖 使用 AI 生成测试用例...');
    const testCases = await prdService.generateTestCasesFromPRD(
      prdRecord.prdId,
      options.saveToDatabase !== false
    );

    console.log(`\n✅ 成功生成 ${testCases.length} 个测试用例:`);
    testCases.forEach((tc, index) => {
      console.log(`   ${index + 1}. ${tc.id} - ${tc.title}`);
    });

    console.log(`\n✅ 完成！PRD ID: ${prdRecord.prdId}`);
  } catch (error) {
    console.error('❌ 生成测试用例失败:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

/**
 * 从 PRD 字符串生成测试用例
 */
export async function generateTestCasesFromPRDString(
  content: string,
  options: {
    prdId?: string;
    saveToDatabase?: boolean;
  }
): Promise<void> {
  try {
    await connectDatabase();

    console.log(`📄 解析 PRD 内容...`);

    // 解析 PRD 内容
    const parser = new PRDParser();
    const prd = await parser.parseContent(content);

    // 如果提供了 prdId，使用它
    if (options.prdId) {
      prd.prdId = options.prdId;
    }

    console.log(`✅ PRD 解析完成: ${prd.title}`);

    // 保存 PRD 到数据库
    console.log('💾 保存 PRD 到数据库...');
    const prdRecord = await prdService.upsertPRD(prd);
    console.log(`✅ PRD 已保存: ${prdRecord.prdId}`);

    // 生成测试用例
    console.log('🤖 使用 AI 生成测试用例...');
    const testCases = await prdService.generateTestCasesFromPRD(
      prdRecord.prdId,
      options.saveToDatabase !== false
    );

    console.log(`\n✅ 成功生成 ${testCases.length} 个测试用例:`);
    testCases.forEach((tc, index) => {
      console.log(`   ${index + 1}. ${tc.id} - ${tc.title}`);
    });

    console.log(`\n✅ 完成！PRD ID: ${prdRecord.prdId}`);
  } catch (error) {
    console.error('❌ 生成测试用例失败:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

